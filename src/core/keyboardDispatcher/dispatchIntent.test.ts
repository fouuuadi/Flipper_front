import { describe, expect, it, vi } from "vitest";

import type { MatchSyncAdapter } from "@services/matchSync";

import { dispatchIntent } from "./dispatchIntent";

function fakeSync(): Pick<MatchSyncAdapter, "dispatch"> {
  return { dispatch: vi.fn() };
}

describe("dispatchIntent", () => {
  describe("contrôles de match → cmd:*", () => {
    it("PAUSE → cmd:pause", () => {
      const sync = fakeSync();
      dispatchIntent({ type: "PAUSE" }, { sync });
      expect(sync.dispatch).toHaveBeenCalledWith({ type: "cmd:pause" });
    });

    it("RESUME → cmd:resume", () => {
      const sync = fakeSync();
      dispatchIntent({ type: "RESUME" }, { sync });
      expect(sync.dispatch).toHaveBeenCalledWith({ type: "cmd:resume" });
    });

    it("ABANDON → cmd:abandon", () => {
      const sync = fakeSync();
      dispatchIntent({ type: "ABANDON" }, { sync });
      expect(sync.dispatch).toHaveBeenCalledWith({ type: "cmd:abandon" });
    });
  });

  describe("navigation → intent", () => {
    it.each([
      ["PRESS_A", "PRESS_A"],
      ["START_GAME", "START_GAME"],
      ["OPEN_LEADERBOARD", "OPEN_LEADERBOARD"],
      ["OPEN_SETTINGS", "OPEN_SETTINGS"],
      ["BACK_TO_MENU", "BACK_TO_MENU"],
      ["REPLAY", "REPLAY"],
    ] as const)("%s → intent %s", (eventType, action) => {
      const sync = fakeSync();
      dispatchIntent({ type: eventType }, { sync });
      expect(sync.dispatch).toHaveBeenCalledWith({ type: "intent", action });
    });

    it("OPEN_COSMETICS → intent OPEN_BOUTIQUE (renommage front→back)", () => {
      const sync = fakeSync();
      dispatchIntent({ type: "OPEN_COSMETICS" }, { sync });
      expect(sync.dispatch).toHaveBeenCalledWith({ type: "intent", action: "OPEN_BOUTIQUE" });
    });
  });

  it("n'émet rien pour un event local non routable (SET_FINAL_DURATION)", () => {
    const sync = fakeSync();
    dispatchIntent({ type: "SET_FINAL_DURATION", durationMs: 1000 }, { sync });
    expect(sync.dispatch).not.toHaveBeenCalled();
  });
});
