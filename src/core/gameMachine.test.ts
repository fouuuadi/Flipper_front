import { describe, expect, it } from "vitest";
import { initialContext, initialState, transition } from "./gameMachine";
import type { MachineSnapshot, PlayerTag } from "./gameMachine.types";

const snapshotAt = (value: MachineSnapshot["value"]): MachineSnapshot => ({
  value,
  context: { ...initialContext },
});

describe("gameMachine — initial state", () => {
  it("starts on splash", () => {
    expect(initialState).toBe("splash");
  });

  it("starts with empty context", () => {
    expect(initialContext).toEqual({
      mode: null,
      players: [],
      currentBall: 1,
      startedAt: null,
      sessionId: null,
    });
  });
});

describe("gameMachine — splash transitions", () => {
  it("splash + PRESS_A → menu", () => {
    const next = transition(snapshotAt("splash"), { type: "PRESS_A" });
    expect(next?.value).toBe("menu");
  });

  it("splash + PAUSE → no transition (invalid event)", () => {
    const next = transition(snapshotAt("splash"), { type: "PAUSE" });
    expect(next).toBeNull();
  });
});

describe("gameMachine — menu transitions", () => {
  it("menu + START_GAME → identification", () => {
    const next = transition(snapshotAt("menu"), { type: "START_GAME" });
    expect(next?.value).toBe("identification");
  });

  it("menu + OPEN_LEADERBOARD → leaderboard", () => {
    const next = transition(snapshotAt("menu"), { type: "OPEN_LEADERBOARD" });
    expect(next?.value).toBe("leaderboard");
  });

  it("menu + RESUME → no transition (invalid)", () => {
    const next = transition(snapshotAt("menu"), { type: "RESUME" });
    expect(next).toBeNull();
  });
});

describe("gameMachine — identification transitions", () => {
  it("identification + PLAYERS_VALIDATED (solo) → playing + context with players + sessionId", () => {
    const next = transition(snapshotAt("identification"), {
      type: "PLAYERS_VALIDATED",
      mode: "solo",
      players: ["fouad#1234" as PlayerTag],
      sessionId: "abc-123",
    });

    expect(next?.value).toBe("playing");
    expect(next?.context.mode).toBe("solo");
    expect(next?.context.players).toHaveLength(1);
    expect(next?.context.players[0]).toEqual({
      tag: "fouad#1234",
      score: 0,
      ballsRemaining: 3,
    });
    expect(next?.context.currentBall).toBe(1);
    expect(next?.context.startedAt).toBeGreaterThan(0);
    expect(next?.context.sessionId).toBe("abc-123");
  });

  it("identification + PLAYERS_VALIDATED (1v1) → playing with 2 players, null sessionId", () => {
    const next = transition(snapshotAt("identification"), {
      type: "PLAYERS_VALIDATED",
      mode: "1v1",
      players: ["a#0001" as PlayerTag, "b#0002" as PlayerTag],
      sessionId: null,
    });

    expect(next?.value).toBe("playing");
    expect(next?.context.mode).toBe("1v1");
    expect(next?.context.players).toHaveLength(2);
    expect(next?.context.sessionId).toBeNull();
  });

  it("identification + BACK_TO_MENU → menu + context reset", () => {
    const next = transition(snapshotAt("identification"), {
      type: "BACK_TO_MENU",
    });
    expect(next?.value).toBe("menu");
    expect(next?.context).toEqual(initialContext);
  });
});

describe("gameMachine — playing transitions", () => {
  it("playing + PAUSE → paused", () => {
    const next = transition(snapshotAt("playing"), { type: "PAUSE" });
    expect(next?.value).toBe("paused");
  });

  it("playing + GAME_OVER → gameOver", () => {
    const next = transition(snapshotAt("playing"), { type: "GAME_OVER" });
    expect(next?.value).toBe("gameOver");
  });

  it("playing + PRESS_A → no transition", () => {
    const next = transition(snapshotAt("playing"), { type: "PRESS_A" });
    expect(next).toBeNull();
  });
});

describe("gameMachine — paused transitions", () => {
  it("paused + RESUME → playing", () => {
    const next = transition(snapshotAt("paused"), { type: "RESUME" });
    expect(next?.value).toBe("playing");
  });

  it("paused + ABANDON → menu + context reset", () => {
    const playingSnapshot: MachineSnapshot = {
      value: "paused",
      context: {
        mode: "solo",
        players: [{ tag: "x#0001" as PlayerTag, score: 9000, ballsRemaining: 1 }],
        currentBall: 3,
        startedAt: 1234,
        sessionId: "session-x",
      },
    };
    const next = transition(playingSnapshot, { type: "ABANDON" });
    expect(next?.value).toBe("menu");
    expect(next?.context).toEqual(initialContext);
  });
});

describe("gameMachine — gameOver transitions", () => {
  it("gameOver + REPLAY → identification + same players, scores reset, sessionId cleared", () => {
    const ended: MachineSnapshot = {
      value: "gameOver",
      context: {
        mode: "1v1",
        players: [
          { tag: "p1#0001" as PlayerTag, score: 1000, ballsRemaining: 0 },
          { tag: "p2#0002" as PlayerTag, score: 500, ballsRemaining: 0 },
        ],
        currentBall: 3,
        startedAt: 1234,
        sessionId: "old-session",
      },
    };
    const next = transition(ended, { type: "REPLAY" });

    expect(next?.value).toBe("identification");
    expect(next?.context.mode).toBe("1v1");
    expect(next?.context.players.map((p) => p.tag)).toEqual(["p1#0001", "p2#0002"]);
    expect(next?.context.players.every((p) => p.score === 0)).toBe(true);
    expect(next?.context.players.every((p) => p.ballsRemaining === 3)).toBe(true);
    expect(next?.context.currentBall).toBe(1);
    expect(next?.context.sessionId).toBeNull();
  });

  it("gameOver + OPEN_LEADERBOARD → leaderboard", () => {
    const next = transition(snapshotAt("gameOver"), {
      type: "OPEN_LEADERBOARD",
    });
    expect(next?.value).toBe("leaderboard");
  });

  it("gameOver + BACK_TO_MENU → menu + context reset", () => {
    const next = transition(snapshotAt("gameOver"), { type: "BACK_TO_MENU" });
    expect(next?.value).toBe("menu");
    expect(next?.context).toEqual(initialContext);
  });
});

describe("gameMachine — leaderboard transitions", () => {
  it("leaderboard + BACK_TO_MENU → menu + context reset", () => {
    const next = transition(snapshotAt("leaderboard"), {
      type: "BACK_TO_MENU",
    });
    expect(next?.value).toBe("menu");
    expect(next?.context).toEqual(initialContext);
  });

  it("leaderboard + PRESS_A → no transition", () => {
    const next = transition(snapshotAt("leaderboard"), { type: "PRESS_A" });
    expect(next).toBeNull();
  });
});

describe("gameMachine — guard against arbitrary jumps", () => {
  // Garde-fou systématique : aucun event ne doit déclencher de transition
  // depuis un état "splash" sauf PRESS_A.
  const allEventsExceptPressA = [
    { type: "START_GAME" as const },
    { type: "PAUSE" as const },
    { type: "RESUME" as const },
    { type: "ABANDON" as const },
    { type: "GAME_OVER" as const },
    { type: "OPEN_LEADERBOARD" as const },
    { type: "BACK_TO_MENU" as const },
    { type: "REPLAY" as const },
  ];

  it.each(allEventsExceptPressA)("splash + $type → no transition", (event) => {
    expect(transition(snapshotAt("splash"), event)).toBeNull();
  });
});
