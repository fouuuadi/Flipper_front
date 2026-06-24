import { describe, expect, it, vi } from "vitest";
import { bindMatchSyncToGameStore } from "./bindToGameStore";
import { MatchSyncAdapter } from "./MatchSyncAdapter";
import type { GameStore } from "@core/gameStore";
import type { GameContext, GameStateValue, MachineSnapshot } from "@core/gameMachine.types";

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

type Applied = { value: GameStateValue; patch?: Partial<GameContext> };

function fakeStore(initial: MachineSnapshot["value"]): GameStore & {
  __applied: Applied[];
} {
  let value = initial;
  const applied: Applied[] = [];
  return {
    getState: () => ({
      value,
      context: {
        mode: null,
        players: [],
        currentBall: 1,
        startedAt: null,
        sessionId: null,
        finalDurationMs: null,
      },
    }),
    send: () => {},
    applyServerState: (v, patch) => {
      applied.push({ value: v, patch });
      value = v;
    },
    subscribe: () => () => {},
    __applied: applied,
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
  sync.connectBorne("borne-1");
  socket!.triggerOpen();
  return { sync, socket: socket! };
}

describe("bindMatchSyncToGameStore — nav:state mapping", () => {
  it.each([
    ["splash", "splash"],
    ["menu", "menu"],
    ["identification", "identification"],
    ["boutique", "cosmetics"],
    ["settings", "settings"],
    ["leaderboard", "leaderboard"],
    ["in_game", "playing"],
    ["game_over", "gameOver"],
  ] as const)("nav %s → état %s", (nav, expected) => {
    const { sync, socket } = setupSync();
    const store = fakeStore("splash");
    bindMatchSyncToGameStore(sync, store);
    socket.triggerMessage({ type: "nav:state", nav, sessionId: null });
    expect(store.__applied).toEqual([{ value: expected, patch: { sessionId: null } }]);
  });

  it("propage le sessionId du nav:state", () => {
    const { sync, socket } = setupSync();
    const store = fakeStore("identification");
    bindMatchSyncToGameStore(sync, store);
    socket.triggerMessage({ type: "nav:state", nav: "in_game", sessionId: "sess-9" });
    expect(store.__applied).toEqual([{ value: "playing", patch: { sessionId: "sess-9" } }]);
  });
});

describe("bindMatchSyncToGameStore — match:state (sous-phase de jeu)", () => {
  it("playing + match:state paused → paused", () => {
    const { sync, socket } = setupSync();
    const store = fakeStore("playing");
    bindMatchSyncToGameStore(sync, store);
    socket.triggerMessage({ type: "match:state", status: "paused", sessionId: "s1" });
    expect(store.__applied).toEqual([{ value: "paused", patch: { sessionId: "s1" } }]);
  });

  it("paused + match:state playing → playing", () => {
    const { sync, socket } = setupSync();
    const store = fakeStore("paused");
    bindMatchSyncToGameStore(sync, store);
    socket.triggerMessage({ type: "match:state", status: "playing", sessionId: "s1" });
    expect(store.__applied).toEqual([{ value: "playing", patch: { sessionId: "s1" } }]);
  });

  it("playing + match:state over → gameOver", () => {
    const { sync, socket } = setupSync();
    const store = fakeStore("playing");
    bindMatchSyncToGameStore(sync, store);
    socket.triggerMessage({ type: "match:state", status: "over", sessionId: "s1" });
    expect(store.__applied).toEqual([{ value: "gameOver", patch: { sessionId: "s1" } }]);
  });

  it("nav:state in_game puis match:state paused → établit playing puis paused", () => {
    const { sync, socket } = setupSync();
    const store = fakeStore("identification");
    bindMatchSyncToGameStore(sync, store);
    socket.triggerMessage({ type: "nav:state", nav: "in_game", sessionId: "s1" });
    socket.triggerMessage({ type: "match:state", status: "paused", sessionId: "s1" });
    expect(store.__applied).toEqual([
      { value: "playing", patch: { sessionId: "s1" } },
      { value: "paused", patch: { sessionId: "s1" } },
    ]);
  });
});

describe("bindMatchSyncToGameStore — events ignorés", () => {
  it("ignore match:state hors phase de jeu (ex: en identification)", () => {
    const { sync, socket } = setupSync();
    const store = fakeStore("identification");
    bindMatchSyncToGameStore(sync, store);
    socket.triggerMessage({ type: "match:state", status: "playing", sessionId: "s1" });
    socket.triggerMessage({ type: "match:state", status: "paused", sessionId: "s1" });
    expect(store.__applied).toEqual([]);
  });

  it("ignore match:state waiting", () => {
    const { sync, socket } = setupSync();
    const store = fakeStore("playing");
    bindMatchSyncToGameStore(sync, store);
    socket.triggerMessage({ type: "match:state", status: "waiting", sessionId: "s1" });
    expect(store.__applied).toEqual([]);
  });

  it("ignore countdown:tick / score:update / ball:lost", () => {
    const { sync, socket } = setupSync();
    const store = fakeStore("playing");
    bindMatchSyncToGameStore(sync, store);
    socket.triggerMessage({ type: "countdown:tick", value: 3 });
    socket.triggerMessage({ type: "score:update", score: 100, combo: 1 });
    socket.triggerMessage({ type: "ball:lost", livesRemaining: 2 });
    expect(store.__applied).toEqual([]);
  });
});

describe("bindMatchSyncToGameStore — unsubscribe", () => {
  it("la fonction retournée arrête le binding", () => {
    const { sync, socket } = setupSync();
    const store = fakeStore("playing");
    const unbind = bindMatchSyncToGameStore(sync, store);
    unbind();
    socket.triggerMessage({ type: "match:state", status: "paused", sessionId: "s1" });
    expect(store.__applied).toEqual([]);
  });
});
