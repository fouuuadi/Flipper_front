import { describe, expect, it, vi } from "vitest";

import { MatchTimer, formatElapsedMs } from "./MatchTimer";

/**
 * Crée un timer avec horloge contrôlable et ticker manuel pour les tests.
 * - `advance(ms)` avance le temps simulé
 * - `tick()` déclenche manuellement le callback du ticker (notifie les abonnés)
 */
function makeTestTimer() {
  let currentTime = 1000;
  let tickerCb: (() => void) | null = null;

  const timer = new MatchTimer({
    now: () => currentTime,
    ticker: (cb) => {
      tickerCb = cb;
      return () => {
        tickerCb = null;
      };
    },
  });

  return {
    timer,
    advance: (ms: number) => {
      currentTime += ms;
    },
    tick: () => tickerCb?.(),
    tickerAttached: () => tickerCb !== null,
  };
}

describe("MatchTimer", () => {
  describe("lifecycle", () => {
    it("démarre en phase idle, elapsedMs = 0", () => {
      const { timer } = makeTestTimer();
      expect(timer.getPhase()).toBe("idle");
      expect(timer.getElapsedMs()).toBe(0);
    });

    it("start() passe en running et attache le ticker", () => {
      const t = makeTestTimer();
      t.timer.start();
      expect(t.timer.getPhase()).toBe("running");
      expect(t.tickerAttached()).toBe(true);
    });

    it("start() est idempotent", () => {
      const t = makeTestTimer();
      t.timer.start();
      t.advance(1000);
      t.timer.start();
      // Le 2e start ne réinitialise PAS (sinon on perdrait du temps de jeu)
      expect(t.timer.getElapsedMs()).toBe(1000);
    });

    it("stop() fige la valeur, détache le ticker", () => {
      const t = makeTestTimer();
      t.timer.start();
      t.advance(5000);
      t.timer.stop();
      expect(t.timer.getPhase()).toBe("stopped");
      expect(t.tickerAttached()).toBe(false);
      expect(t.timer.getElapsedMs()).toBe(5000);

      // Le temps continue d'avancer mais la valeur reste figée
      t.advance(3000);
      expect(t.timer.getElapsedMs()).toBe(5000);
    });

    it("reset() repasse en idle (utile entre 2 parties)", () => {
      const t = makeTestTimer();
      t.timer.start();
      t.advance(2000);
      t.timer.stop();
      t.timer.reset();
      expect(t.timer.getPhase()).toBe("idle");
      expect(t.timer.getElapsedMs()).toBe(0);
    });
  });

  describe("freeze / unfreeze (gestion des pauses)", () => {
    it("freeze() pendant running fige la valeur et détache le ticker", () => {
      const t = makeTestTimer();
      t.timer.start();
      t.advance(2000);
      t.timer.freeze();
      expect(t.timer.getPhase()).toBe("frozen");
      expect(t.tickerAttached()).toBe(false);
      expect(t.timer.getElapsedMs()).toBe(2000);

      // Le temps avance mais le compteur reste figé
      t.advance(5000);
      expect(t.timer.getElapsedMs()).toBe(2000);
    });

    it("unfreeze() repart sans compter le temps de pause", () => {
      const t = makeTestTimer();
      t.timer.start();
      t.advance(2000); // 2s de jeu
      t.timer.freeze();
      t.advance(10000); // 10s de pause (ne compte pas)
      t.timer.unfreeze();
      expect(t.timer.getPhase()).toBe("running");
      t.advance(3000); // 3s de jeu
      expect(t.timer.getElapsedMs()).toBe(5000); // 2 + 3, pas 15
    });

    it("supporte plusieurs cycles freeze/unfreeze (additionne les pauses)", () => {
      const t = makeTestTimer();
      t.timer.start();
      t.advance(1000);
      t.timer.freeze();
      t.advance(5000); // pause 1
      t.timer.unfreeze();
      t.advance(2000);
      t.timer.freeze();
      t.advance(7000); // pause 2
      t.timer.unfreeze();
      t.advance(1000);
      expect(t.timer.getElapsedMs()).toBe(4000); // 1 + 2 + 1
    });

    it("stop() pendant frozen ne compte pas la pause en cours", () => {
      const t = makeTestTimer();
      t.timer.start();
      t.advance(3000);
      t.timer.freeze();
      t.advance(10000); // pause en cours
      t.timer.stop();
      expect(t.timer.getElapsedMs()).toBe(3000);
    });

    it("freeze() no-op si pas en running (ex: déjà frozen ou idle)", () => {
      const t = makeTestTimer();
      t.timer.freeze(); // idle
      expect(t.timer.getPhase()).toBe("idle");

      t.timer.start();
      t.timer.freeze();
      t.timer.freeze(); // déjà frozen
      expect(t.timer.getPhase()).toBe("frozen");
    });

    it("unfreeze() no-op si pas en frozen", () => {
      const t = makeTestTimer();
      t.timer.unfreeze(); // idle
      expect(t.timer.getPhase()).toBe("idle");

      t.timer.start();
      t.timer.unfreeze(); // running
      expect(t.timer.getPhase()).toBe("running");
    });
  });

  describe("subscribe / notify", () => {
    it("notifie les abonnés sur start/freeze/unfreeze/stop/reset", () => {
      const t = makeTestTimer();
      const listener = vi.fn();
      t.timer.subscribe(listener);

      t.timer.start();
      t.timer.freeze();
      t.timer.unfreeze();
      t.timer.stop();
      t.timer.reset();

      expect(listener).toHaveBeenCalledTimes(5);
    });

    it("notifie sur chaque tick du ticker", () => {
      const t = makeTestTimer();
      const listener = vi.fn();
      t.timer.subscribe(listener);
      t.timer.start();
      listener.mockClear();

      t.advance(1000);
      t.tick();
      t.advance(1000);
      t.tick();

      expect(listener).toHaveBeenCalledTimes(2);
    });

    it("le listener reçoit la valeur elapsedMs courante", () => {
      const t = makeTestTimer();
      const values: number[] = [];
      t.timer.subscribe((ms) => values.push(ms));
      t.timer.start();
      t.advance(1500);
      t.tick();
      t.advance(2000);
      t.tick();

      expect(values).toEqual([0, 1500, 3500]);
    });

    it("désabonne via le disposer retourné", () => {
      const t = makeTestTimer();
      const listener = vi.fn();
      const unsubscribe = t.timer.subscribe(listener);
      unsubscribe();
      t.timer.start();
      t.tick();
      expect(listener).not.toHaveBeenCalled();
    });
  });
});

describe("formatElapsedMs", () => {
  it("formate 0 ms → 00:00", () => {
    expect(formatElapsedMs(0)).toBe("00:00");
  });

  it("formate les secondes seules", () => {
    expect(formatElapsedMs(5000)).toBe("00:05");
    expect(formatElapsedMs(59000)).toBe("00:59");
  });

  it("formate les minutes", () => {
    expect(formatElapsedMs(60000)).toBe("01:00");
    expect(formatElapsedMs(150000)).toBe("02:30");
    expect(formatElapsedMs(599000)).toBe("09:59");
  });

  it("plafonne à 99:59 au-delà d'1h40", () => {
    expect(formatElapsedMs(5999000)).toBe("99:59");
    expect(formatElapsedMs(9_999_999)).toBe("99:59");
  });

  it("ignore les millisecondes < 1s", () => {
    expect(formatElapsedMs(1999)).toBe("00:01");
  });
});
