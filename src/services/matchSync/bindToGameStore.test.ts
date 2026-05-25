import { describe, expect, it, vi } from "vitest";
import { bindMatchSyncToGameStore } from "./bindToGameStore";
import { MatchSyncAdapter } from "./MatchSyncAdapter";
import type { GameStore } from "@core/gameStore";
import type { GameEvent, MachineSnapshot } from "@core/gameMachine.types";

class MockSocket {
  static readonly OPEN = 1;
  readyState = MockSocket.OPEN;
  private listeners: Record<string, Array<(event: unknown) => void>> = {
    open: [],
    message: [],
    close: [],
    error: [],
  };
  send = vi.fn();
  close = vi.fn();

  addEventListener(type: string, listener: (event: unknown) => void): void {
    this.listeners[type]?.push(listener);
  }

  triggerOpen(): void {
    this.listeners.open?.forEach((l) => l({}));
  }

  triggerMessage(data: unknown): void {
    this.listeners.message?.forEach((l) => l({ data: JSON.stringify(data) }));
  }
}

function fakeStore(initial: MachineSnapshot["value"]): GameStore & {
  __sent: GameEvent[];
  __setState: (value: MachineSnapshot["value"]) => void;
} {
  let value = initial;
  const sent: GameEvent[] = [];
  return {
    getState: () => ({
      value,
      context: {
        mode: null,
        players: [],
        currentBall: 1,
        startedAt: null,
        sessionId: null,
      },
    }),
    send: (event: GameEvent) => {
      sent.push(event);
    },
    subscribe: () => () => {},
    __sent: sent,
    __setState: (v) => {
      value = v;
    },
  };
}

function setupSync(): { sync: MatchSyncAdapter; socket: MockSocket } {
  let socket: MockSocket | null = null;
  const sync = new MatchSyncAdapter({
    baseWsUrl: "ws://t/ws",
    socketFactory: () => {
      socket = new MockSocket();
      return socket as unknown as WebSocket;
    },
  });
  sync.connect("s1");
  socket!.triggerOpen();
  return { sync, socket: socket! };
}

describe("bindMatchSyncToGameStore — match:state mapping", () => {
  it("playing + match:state paused → PAUSE", () => {
    const { sync, socket } = setupSync();
    const store = fakeStore("playing");
    bindMatchSyncToGameStore(sync, store);
    socket.triggerMessage({
      type: "match:state",
      status: "paused",
      sessionId: "s1",
    });
    expect(store.__sent).toEqual([{ type: "PAUSE" }]);
  });

  it("paused + match:state playing → RESUME", () => {
    const { sync, socket } = setupSync();
    const store = fakeStore("paused");
    bindMatchSyncToGameStore(sync, store);
    socket.triggerMessage({
      type: "match:state",
      status: "playing",
      sessionId: "s1",
    });
    expect(store.__sent).toEqual([{ type: "RESUME" }]);
  });

  it("playing + match:state over → GAME_OVER", () => {
    const { sync, socket } = setupSync();
    const store = fakeStore("playing");
    bindMatchSyncToGameStore(sync, store);
    socket.triggerMessage({
      type: "match:state",
      status: "over",
      sessionId: "s1",
    });
    expect(store.__sent).toEqual([{ type: "GAME_OVER" }]);
  });

  it("paused + match:state over → GAME_OVER (abandon depuis pause)", () => {
    const { sync, socket } = setupSync();
    const store = fakeStore("paused");
    bindMatchSyncToGameStore(sync, store);
    socket.triggerMessage({
      type: "match:state",
      status: "over",
      sessionId: "s1",
    });
    expect(store.__sent).toEqual([{ type: "GAME_OVER" }]);
  });
});

describe("bindMatchSyncToGameStore — events ignorés", () => {
  it("ignore match:state ready/waiting (transitions locales)", () => {
    const { sync, socket } = setupSync();
    const store = fakeStore("identification");
    bindMatchSyncToGameStore(sync, store);
    socket.triggerMessage({
      type: "match:state",
      status: "ready",
      sessionId: "s1",
    });
    socket.triggerMessage({
      type: "match:state",
      status: "waiting",
      sessionId: "s1",
    });
    expect(store.__sent).toEqual([]);
  });

  it("ignore match:state playing si on n'est pas en paused", () => {
    const { sync, socket } = setupSync();
    const store = fakeStore("identification");
    bindMatchSyncToGameStore(sync, store);
    socket.triggerMessage({
      type: "match:state",
      status: "playing",
      sessionId: "s1",
    });
    expect(store.__sent).toEqual([]);
  });

  it("ignore countdown:tick (consommé par l'overlay countdown)", () => {
    const { sync, socket } = setupSync();
    const store = fakeStore("playing");
    bindMatchSyncToGameStore(sync, store);
    socket.triggerMessage({ type: "countdown:tick", value: 3 });
    expect(store.__sent).toEqual([]);
  });

  it("ignore score:update et ball:lost (consommés par le HUD)", () => {
    const { sync, socket } = setupSync();
    const store = fakeStore("playing");
    bindMatchSyncToGameStore(sync, store);
    socket.triggerMessage({ type: "score:update", score: 100, combo: 1 });
    socket.triggerMessage({ type: "ball:lost", livesRemaining: 2 });
    expect(store.__sent).toEqual([]);
  });
});

describe("bindMatchSyncToGameStore — unsubscribe", () => {
  it("la fonction retournée arrête le binding", () => {
    const { sync, socket } = setupSync();
    const store = fakeStore("playing");
    const unbind = bindMatchSyncToGameStore(sync, store);
    unbind();
    socket.triggerMessage({
      type: "match:state",
      status: "paused",
      sessionId: "s1",
    });
    expect(store.__sent).toEqual([]);
  });
});
