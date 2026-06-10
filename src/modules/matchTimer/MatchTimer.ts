/**
 * Chronomètre de durée de partie.
 *
 * Cycle de vie typique :
 *   start()           → début effectif de la partie (après tick countdown 0)
 *   freeze()          → entrée en pause, on accumule le temps actif
 *   unfreeze()        → sortie de pause, on relance sans compter la pause
 *   stop()            → fin de partie, valeur figée
 *   getElapsedMs()    → renvoie le temps de jeu EFFECTIF (sans pauses)
 *
 * La précision est limitée par le `ticker` injecté (par défaut 1 seconde via
 * `setInterval`), ce qui suffit pour afficher mm:ss. Les calculs internes
 * passent par `now()` (par défaut `Date.now()`), eux précis à la milliseconde.
 *
 * Pure et autonome : aucun couplage à la state machine ni à `matchSync`.
 * L'orchestration (start au passage en playing, freeze sur match:state paused…)
 * est faite par l'appelant (`src/main.ts` côté playfield, `BackglassApp` côté
 * backglass).
 */

export interface MatchTimerOptions {
  /** Source d'horodatage. Injectable pour les tests. Défaut: `Date.now`. */
  readonly now?: () => number;
  /**
   * Démarre/arrête un ticker périodique qui notifie les abonnés à intervalle
   * régulier. Reçoit un callback à invoquer périodiquement, retourne un
   * disposer. Défaut: `setInterval` à 1 s.
   */
  readonly ticker?: (cb: () => void) => () => void;
}

type Phase = "idle" | "running" | "frozen" | "stopped";

export class MatchTimer {
  private readonly now: () => number;
  private readonly startTicker: (cb: () => void) => () => void;
  private readonly listeners = new Set<(elapsedMs: number) => void>();

  private phase: Phase = "idle";
  /** Timestamp de démarrage absolu (premier `start()`). Null en idle. */
  private startedAt: number | null = null;
  /**
   * Total des durées de pauses accumulées (en ms). Soustrait du temps absolu
   * pour obtenir la durée effective.
   */
  private pausedAccumulatedMs = 0;
  /** Timestamp d'entrée en pause (frozen). Null sinon. */
  private freezeStartedAt: number | null = null;
  /** Valeur figée à `stop()`. Null tant que la partie tourne ou est en pause. */
  private finalElapsedMs: number | null = null;

  private stopTicker: (() => void) | null = null;

  constructor(options: MatchTimerOptions = {}) {
    this.now = options.now ?? (() => Date.now());
    this.startTicker = options.ticker ?? defaultTicker;
  }

  /** Démarre le chronomètre. No-op si déjà démarré. */
  start(): void {
    if (this.phase !== "idle") return;
    this.startedAt = this.now();
    this.pausedAccumulatedMs = 0;
    this.freezeStartedAt = null;
    this.finalElapsedMs = null;
    this.phase = "running";
    this.attachTicker();
    this.notify();
  }

  /** Fige le compteur (entrée en pause). No-op si pas en `running`. */
  freeze(): void {
    if (this.phase !== "running") return;
    this.freezeStartedAt = this.now();
    this.phase = "frozen";
    this.detachTicker();
    this.notify();
  }

  /** Repart depuis la pause. No-op si pas en `frozen`. */
  unfreeze(): void {
    if (this.phase !== "frozen") return;
    if (this.freezeStartedAt !== null) {
      this.pausedAccumulatedMs += this.now() - this.freezeStartedAt;
      this.freezeStartedAt = null;
    }
    this.phase = "running";
    this.attachTicker();
    this.notify();
  }

  /**
   * Arrête définitivement le chronomètre et fige sa valeur.
   * Si appelé pendant `frozen`, la pause en cours n'est PAS comptée.
   */
  stop(): void {
    if (this.phase === "idle" || this.phase === "stopped") return;
    const value = this.computeElapsed();
    this.finalElapsedMs = value;
    this.phase = "stopped";
    this.detachTicker();
    this.notify();
  }

  /**
   * Reset complet — repasse en `idle`. Utile entre 2 parties (REPLAY).
   */
  reset(): void {
    this.detachTicker();
    this.phase = "idle";
    this.startedAt = null;
    this.pausedAccumulatedMs = 0;
    this.freezeStartedAt = null;
    this.finalElapsedMs = null;
    this.notify();
  }

  /**
   * Durée de jeu effective en ms (hors pauses).
   * - `running` : temps courant - démarrage - pauses accumulées
   * - `frozen` : temps figé au début de la pause - démarrage - pauses précédentes
   * - `stopped` : valeur figée par `stop()`
   * - `idle` : 0
   */
  getElapsedMs(): number {
    return this.computeElapsed();
  }

  /** S'abonne aux changements (transitions de phase + ticks périodiques). */
  subscribe(listener: (elapsedMs: number) => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  /** Phase courante. Exposée pour les tests / debug. */
  getPhase(): Phase {
    return this.phase;
  }

  // ─── internals ──────────────────────────────────────────────────────────

  private computeElapsed(): number {
    if (this.phase === "stopped" && this.finalElapsedMs !== null) {
      return this.finalElapsedMs;
    }
    if (this.startedAt === null) return 0;

    if (this.phase === "frozen" && this.freezeStartedAt !== null) {
      // Temps absolu = freezeStartedAt (le freeze fige l'horloge)
      return Math.max(0, this.freezeStartedAt - this.startedAt - this.pausedAccumulatedMs);
    }
    // running ou stopped sans finalElapsedMs (cas marginal)
    return Math.max(0, this.now() - this.startedAt - this.pausedAccumulatedMs);
  }

  private attachTicker(): void {
    if (this.stopTicker) return;
    this.stopTicker = this.startTicker(() => this.notify());
  }

  private detachTicker(): void {
    this.stopTicker?.();
    this.stopTicker = null;
  }

  private notify(): void {
    const elapsed = this.computeElapsed();
    for (const listener of this.listeners) {
      listener(elapsed);
    }
  }
}

/**
 * Ticker par défaut : `setInterval` 1 s. Adapté pour un affichage mm:ss.
 * Pour une précision sub-seconde, injecter un ticker basé sur
 * `requestAnimationFrame`.
 */
function defaultTicker(cb: () => void): () => void {
  const id = setInterval(cb, 1000);
  return () => clearInterval(id);
}

/**
 * Format mm:ss pour affichage UI. Plafonne à 99:59 si la partie dure plus
 * d'une heure (cas hyper marginal, mais évite que mm dépasse 2 chiffres et
 * casse l'alignement HUD).
 */
const MAX_DISPLAYABLE_SECONDS = 99 * 60 + 59; // 99:59

export function formatElapsedMs(elapsedMs: number): string {
  const totalSeconds = Math.max(0, Math.floor(elapsedMs / 1000));
  const capped = Math.min(MAX_DISPLAYABLE_SECONDS, totalSeconds);
  const minutes = Math.floor(capped / 60);
  const seconds = capped % 60;
  return `${pad2(minutes)}:${pad2(seconds)}`;
}

function pad2(n: number): string {
  return n.toString().padStart(2, "0");
}
