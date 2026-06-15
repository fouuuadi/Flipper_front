import { describe, expect, it } from "vitest";

import { createGameStore } from "@core/gameStore";
import { MatchTimer } from "./MatchTimer";
import { bindMatchTimerToStore } from "./bindMatchTimerToStore";

/**
 * Pilote la SM jusqu'à `playing` (splash → menu → identification → playing).
 */
function driveToPlaying(store: ReturnType<typeof createGameStore>): void {
  store.send({ type: "PRESS_A" });
  store.send({ type: "START_GAME" });
  store.send({
    type: "PLAYERS_VALIDATED",
    mode: "solo",
    players: ["DEV#0001"],
    sessionId: null,
  });
}

describe("bindMatchTimerToStore", () => {
  it("démarre le chrono au passage en playing", () => {
    const store = createGameStore();
    const clock = 0;
    const timer = new MatchTimer({ now: () => clock, ticker: () => () => {} });
    bindMatchTimerToStore(store, timer);

    expect(timer.getPhase()).toBe("idle");
    driveToPlaying(store);
    expect(timer.getPhase()).toBe("running");
  });

  it("gèle en pause et reprend sans compter le temps de pause", () => {
    const store = createGameStore();
    let clock = 0;
    const timer = new MatchTimer({ now: () => clock, ticker: () => () => {} });
    bindMatchTimerToStore(store, timer);

    driveToPlaying(store);
    clock = 1000; // 1 s de jeu
    store.send({ type: "PAUSE" });
    expect(timer.getPhase()).toBe("frozen");

    clock = 5000; // 4 s de pause (ne doivent pas compter)
    store.send({ type: "RESUME" });
    expect(timer.getPhase()).toBe("running");

    clock = 6000; // +1 s de jeu → 2 s effectives
    expect(timer.getElapsedMs()).toBe(2000);
  });

  it("arrête le chrono et persiste la durée finale au gameOver", () => {
    const store = createGameStore();
    let clock = 0;
    const timer = new MatchTimer({ now: () => clock, ticker: () => () => {} });
    bindMatchTimerToStore(store, timer);

    driveToPlaying(store);
    clock = 3000;
    store.send({ type: "GAME_OVER" });

    expect(timer.getPhase()).toBe("stopped");
    expect(store.getState().context.finalDurationMs).toBe(3000);
  });

  it("réinitialise le chrono quand on revient dans un écran hors partie", () => {
    const store = createGameStore();
    let clock = 0;
    const timer = new MatchTimer({ now: () => clock, ticker: () => () => {} });
    bindMatchTimerToStore(store, timer);

    driveToPlaying(store);
    clock = 2000;
    store.send({ type: "GAME_OVER" }); // stopped
    store.send({ type: "BACK_TO_MENU" }); // gameOver → menu

    expect(timer.getPhase()).toBe("idle");
  });
});
