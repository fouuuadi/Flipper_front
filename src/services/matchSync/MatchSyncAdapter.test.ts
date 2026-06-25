import { beforeEach, describe, expect, it, vi } from "vitest";
import { MatchSyncAdapter } from "./MatchSyncAdapter";
import type { WsServerEvent } from "./protocol";

/**
 * Mock minimal de l'interface `WebSocket` (vitest tourne en env node, pas de WS natif).
 * Reproduit le strict nécessaire pour piloter manuellement open/message/close.
 */
class MockWebSocket implements Partial<WebSocket> {
  static readonly CONNECTING = 0;
  static readonly OPEN = 1;
  static readonly CLOSING = 2;
  static readonly CLOSED = 3;

  readyState: number = MockWebSocket.CONNECTING;
  sent: string[] = [];
  url: string;

  private listeners: Record<string, Array<(event: unknown) => void>> = {
    open: [],
    message: [],
    close: [],
    error: [],
  };

  constructor(url: string) {
    this.url = url;
  }

  addEventListener(type: string, listener: (event: unknown) => void): void {
    this.listeners[type]?.push(listener);
  }

  send(data: string): void {
    this.sent.push(data);
  }

  close(): void {
    this.readyState = MockWebSocket.CLOSED;
    this.emit("close", {});
  }

  // Helpers de test
  triggerOpen(): void {
    this.readyState = MockWebSocket.OPEN;
    this.emit("open", {});
  }

  triggerMessage(data: string): void {
    this.emit("message", { data });
  }

  triggerError(): void {
    this.emit("error", {});
  }

  private emit(type: string, event: unknown): void {
    this.listeners[type]?.forEach((l) => l(event));
  }
}

// On expose les constantes statiques sur le globalThis pour que l'adapter
// puisse comparer `WebSocket.OPEN` même sans WebSocket natif côté node.
(globalThis as unknown as { WebSocket: typeof MockWebSocket }).WebSocket = MockWebSocket;

let lastSocket: MockWebSocket | null = null;
const factory = (url: string): WebSocket => {
  lastSocket = new MockWebSocket(url);
  return lastSocket as unknown as WebSocket;
};

beforeEach(() => {
  lastSocket = null;
  vi.useFakeTimers();
});

describe("MatchSyncAdapter — connect / disconnect", () => {
  it("ouvre une WS sur ?session_id= au connect", () => {
    const sync = new MatchSyncAdapter({
      baseWsUrl: "ws://test:8080/ws",
      socketFactory: factory,
    });
    sync.connect("abc123");
    expect(lastSocket?.url).toBe("ws://test:8080/ws?session_id=abc123");
  });

  it("encode le sessionId dans l'URL", () => {
    const sync = new MatchSyncAdapter({
      baseWsUrl: "ws://t/ws",
      socketFactory: factory,
    });
    sync.connect("a/b c");
    expect(lastSocket?.url).toContain("session_id=a%2Fb%20c");
  });

  it("disconnect ferme la socket et n'auto-reconnect pas", () => {
    const sync = new MatchSyncAdapter({
      baseWsUrl: "ws://t/ws",
      socketFactory: factory,
    });
    sync.connect("s1");
    const first = lastSocket;
    sync.disconnect();
    expect(first?.readyState).toBe(MockWebSocket.CLOSED);

    // Avance le temps : aucune nouvelle socket ne doit s'ouvrir
    vi.advanceTimersByTime(60_000);
    expect(lastSocket).toBe(first);
  });

  it("connect remplace une session précédente", () => {
    const sync = new MatchSyncAdapter({
      baseWsUrl: "ws://t/ws",
      socketFactory: factory,
    });
    sync.connect("s1");
    const first = lastSocket;
    sync.connect("s2");
    expect(first?.readyState).toBe(MockWebSocket.CLOSED);
    expect(lastSocket?.url).toContain("session_id=s2");
  });

  it("connectBorne ouvre une WS sur ?borne_id=", () => {
    const sync = new MatchSyncAdapter({
      baseWsUrl: "ws://test:8080/ws",
      socketFactory: factory,
    });
    sync.connectBorne("borne-42");
    expect(lastSocket?.url).toBe("ws://test:8080/ws?borne_id=borne-42");
  });

  it("connectBorne reconnecte sur le même canal après une fermeture", () => {
    const sync = new MatchSyncAdapter({
      baseWsUrl: "ws://t/ws",
      socketFactory: factory,
    });
    sync.connectBorne("borne-42");
    const first = lastSocket;
    first?.triggerOpen();
    first?.close();
    vi.advanceTimersByTime(1000);
    expect(lastSocket).not.toBe(first);
    expect(lastSocket?.url).toContain("borne_id=borne-42");
  });
});

describe("MatchSyncAdapter — onEvent (server → client)", () => {
  it("dispatch les events serveur reconnus aux listeners", () => {
    const sync = new MatchSyncAdapter({
      baseWsUrl: "ws://t/ws",
      socketFactory: factory,
    });
    const received: WsServerEvent[] = [];
    sync.onEvent((e) => received.push(e));
    sync.connect("s1");
    lastSocket?.triggerOpen();
    lastSocket?.triggerMessage(
      JSON.stringify({
        type: "match:state",
        status: "paused",
        sessionId: "s1",
      }),
    );
    expect(received).toHaveLength(1);
    expect(received[0]).toEqual({
      type: "match:state",
      status: "paused",
      sessionId: "s1",
    });
  });

  it("ignore les payloads non-JSON", () => {
    const sync = new MatchSyncAdapter({
      baseWsUrl: "ws://t/ws",
      socketFactory: factory,
    });
    const received: WsServerEvent[] = [];
    sync.onEvent((e) => received.push(e));
    sync.connect("s1");
    lastSocket?.triggerOpen();
    lastSocket?.triggerMessage("{not json");
    expect(received).toHaveLength(0);
  });

  it("ignore les events de type inconnu", () => {
    const sync = new MatchSyncAdapter({
      baseWsUrl: "ws://t/ws",
      socketFactory: factory,
    });
    const received: WsServerEvent[] = [];
    sync.onEvent((e) => received.push(e));
    sync.connect("s1");
    lastSocket?.triggerOpen();
    lastSocket?.triggerMessage(JSON.stringify({ type: "weird:event", foo: 1 }));
    expect(received).toHaveLength(0);
  });

  it("permet de se désabonner via la fonction renvoyée", () => {
    const sync = new MatchSyncAdapter({
      baseWsUrl: "ws://t/ws",
      socketFactory: factory,
    });
    const received: WsServerEvent[] = [];
    const unsub = sync.onEvent((e) => received.push(e));
    sync.connect("s1");
    lastSocket?.triggerOpen();
    unsub();
    lastSocket?.triggerMessage(JSON.stringify({ type: "ball:lost", livesRemaining: 2 }));
    expect(received).toHaveLength(0);
  });
});

describe("MatchSyncAdapter — dispatch (client → server)", () => {
  it("envoie la commande quand la socket est OPEN", () => {
    const sync = new MatchSyncAdapter({
      baseWsUrl: "ws://t/ws",
      socketFactory: factory,
    });
    sync.connect("s1");
    lastSocket?.triggerOpen();
    sync.dispatch({ type: "cmd:pause" });
    expect(lastSocket?.sent).toEqual([JSON.stringify({ type: "cmd:pause" })]);
  });

  it("bufferise les commandes envoyées avant l'ouverture, flush à open", () => {
    const sync = new MatchSyncAdapter({
      baseWsUrl: "ws://t/ws",
      socketFactory: factory,
    });
    sync.connect("s1");
    // Socket CONNECTING ici
    sync.dispatch({ type: "cmd:pause" });
    sync.dispatch({ type: "cmd:resume" });
    expect(lastSocket?.sent).toEqual([]);
    lastSocket?.triggerOpen();
    expect(lastSocket?.sent).toEqual([
      JSON.stringify({ type: "cmd:pause" }),
      JSON.stringify({ type: "cmd:resume" }),
    ]);
  });

  it("vide la file au disconnect", () => {
    const sync = new MatchSyncAdapter({
      baseWsUrl: "ws://t/ws",
      socketFactory: factory,
    });
    sync.connect("s1");
    sync.dispatch({ type: "cmd:abandon" });
    sync.disconnect();
    // Nouvelle session, nouvelle file
    sync.connect("s2");
    lastSocket?.triggerOpen();
    expect(lastSocket?.sent).toEqual([]);
  });

  it("relaie au backend un event de jeu publié quand la borne est connectée", () => {
    const sync = new MatchSyncAdapter({
      baseWsUrl: "ws://t/ws",
      socketFactory: factory,
    });
    const received: unknown[] = [];
    sync.onEvent((e) => received.push(e));
    sync.connectBorne("borne-1");
    lastSocket?.triggerOpen();

    const scoreEvent = { type: "score:update", score: 750, combo: 1 } as const;
    sync.publish(scoreEvent);

    // Diffusé localement…
    expect(received).toEqual([scoreEvent]);
    // …et relayé au backend pour les autres écrans.
    expect(lastSocket?.sent).toEqual([JSON.stringify({ type: "borne:relay", event: scoreEvent })]);
  });
});

describe("MatchSyncAdapter — reconnect", () => {
  it("reconnecte avec un délai exponentiel après une fermeture inattendue", () => {
    const sync = new MatchSyncAdapter({
      baseWsUrl: "ws://t/ws",
      socketFactory: factory,
    });
    sync.connect("s1");
    const first = lastSocket;
    first?.triggerOpen();

    // Simule une déconnexion serveur
    first?.close();
    expect(lastSocket).toBe(first);

    // 1ère tentative : 1s
    vi.advanceTimersByTime(1000);
    expect(lastSocket).not.toBe(first);
    expect(lastSocket?.url).toContain("session_id=s1");

    // 2ème tentative : 2s
    lastSocket?.close();
    vi.advanceTimersByTime(2000);
  });

  it("ne reconnecte pas après un disconnect explicite", () => {
    const sync = new MatchSyncAdapter({
      baseWsUrl: "ws://t/ws",
      socketFactory: factory,
    });
    sync.connect("s1");
    lastSocket?.triggerOpen();
    sync.disconnect();
    const closed = lastSocket;
    vi.advanceTimersByTime(60_000);
    expect(lastSocket).toBe(closed);
  });
});
