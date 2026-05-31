import { beforeEach, describe, expect, it, vi } from "vitest";

import type { GameStore } from "@core/gameStore";
import type { MachineSnapshot } from "@core/gameMachine.types";
import type { MatchSyncAdapter } from "@services/matchSync";

import { dispatchIntent } from "./dispatchIntent";

function fakeStore(snapshot: MachineSnapshot): Pick<GameStore, "getState" | "send"> {
  return {
    getState: () => snapshot,
    send: vi.fn(),
  };
}

function fakeSync(): Pick<MatchSyncAdapter, "dispatch"> {
  return { dispatch: vi.fn() };
}

function snapshot(sessionId: string | null): MachineSnapshot {
  return {
    value: "playing",
    context: {
      mode: "solo",
      players: [],
      currentBall: 1,
      startedAt: null,
      sessionId,
      finalDurationMs: null,
    },
  };
}

describe("dispatchIntent", () => {
  describe("avec sessionId (mode online)", () => {
    let store: Pick<GameStore, "getState" | "send">;
    let sync: Pick<MatchSyncAdapter, "dispatch">;

    beforeEach(() => {
      store = fakeStore(snapshot("sid-123"));
      sync = fakeSync();
    });

    it("PAUSE → cmd:pause sur le WS, ne touche pas le store", () => {
      dispatchIntent({ type: "PAUSE" }, { store, sync });
      expect(sync.dispatch).toHaveBeenCalledWith({ type: "cmd:pause" });
      expect(store.send).not.toHaveBeenCalled();
    });

    it("RESUME → cmd:resume", () => {
      dispatchIntent({ type: "RESUME" }, { store, sync });
      expect(sync.dispatch).toHaveBeenCalledWith({ type: "cmd:resume" });
      expect(store.send).not.toHaveBeenCalled();
    });

    it("ABANDON → cmd:abandon", () => {
      dispatchIntent({ type: "ABANDON" }, { store, sync });
      expect(sync.dispatch).toHaveBeenCalledWith({ type: "cmd:abandon" });
      expect(store.send).not.toHaveBeenCalled();
    });

    it("les autres events (BACK_TO_MENU, REPLAY, …) passent au store direct", () => {
      dispatchIntent({ type: "BACK_TO_MENU" }, { store, sync });
      expect(store.send).toHaveBeenCalledWith({ type: "BACK_TO_MENU" });
      expect(sync.dispatch).not.toHaveBeenCalled();
    });
  });

  describe("sans sessionId (mode 1v1 mock / offline)", () => {
    let store: Pick<GameStore, "getState" | "send">;
    let sync: Pick<MatchSyncAdapter, "dispatch">;

    beforeEach(() => {
      store = fakeStore(snapshot(null));
      sync = fakeSync();
    });

    it("PAUSE → store.send direct, jamais sync.dispatch", () => {
      dispatchIntent({ type: "PAUSE" }, { store, sync });
      expect(store.send).toHaveBeenCalledWith({ type: "PAUSE" });
      expect(sync.dispatch).not.toHaveBeenCalled();
    });

    it("RESUME → store.send direct", () => {
      dispatchIntent({ type: "RESUME" }, { store, sync });
      expect(store.send).toHaveBeenCalledWith({ type: "RESUME" });
      expect(sync.dispatch).not.toHaveBeenCalled();
    });

    it("ABANDON → store.send direct (transition SM `paused`→`menu`)", () => {
      dispatchIntent({ type: "ABANDON" }, { store, sync });
      expect(store.send).toHaveBeenCalledWith({ type: "ABANDON" });
      expect(sync.dispatch).not.toHaveBeenCalled();
    });
  });
});
