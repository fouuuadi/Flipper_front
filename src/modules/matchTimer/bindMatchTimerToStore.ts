import type { GameStore } from "@core/gameStore";
import { MatchTimer } from "./MatchTimer";

/**
 * Orchestre un {@link MatchTimer} sur la state machine : démarre / gèle /
 * reprend / arrête le chrono de partie selon l'état SM, et persiste la durée
 * finale dans le contexte (event `SET_FINAL_DURATION`) au passage en `gameOver`.
 *
 * Même esprit que `bindMatchSyncToGameStore` : à câbler une fois au boot.
 *
 * @param store le store de jeu à observer.
 * @param timer chrono à piloter (injectable pour les tests ; par défaut un
 *              `MatchTimer` neuf).
 * @returns une fonction d'unsubscribe — à appeler dans le teardown.
 */
export function bindMatchTimerToStore(
  store: GameStore,
  timer: MatchTimer = new MatchTimer(),
): () => void {
  return store.subscribe(({ value }) => {
    const phase = timer.getPhase();
    switch (value) {
      case "playing":
        if (phase === "idle") timer.start();
        else if (phase === "frozen") timer.unfreeze();
        break;
      case "paused":
        if (phase === "running") timer.freeze();
        break;
      case "gameOver":
        if (phase === "running" || phase === "frozen") {
          timer.stop();
          store.send({ type: "SET_FINAL_DURATION", durationMs: timer.getElapsedMs() });
        }
        break;
      case "splash":
      case "menu":
      case "identification":
      case "leaderboard":
        if (phase !== "idle") timer.reset();
        break;
    }
  });
}
