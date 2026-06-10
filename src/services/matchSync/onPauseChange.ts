import type { MatchSyncAdapter } from "./MatchSyncAdapter";

/**
 * Notifie un handler à chaque transition pause/non-pause reçue du back.
 *
 * - `isPaused = true`  quand `match:state: paused` arrive
 * - `isPaused = false` sur n'importe quel autre statut (`playing`, `ready`,
 *   `over`, `waiting`)
 *
 * Le handler n'est appelé QUE si la valeur change réellement (dédup interne).
 * Pas d'invocation immédiate au subscribe — le consommateur est supposé
 * initialiser son état lui-même puis réagir aux transitions.
 *
 * Indépendant de la state machine front : c'est un utility branché
 * directement sur le `matchSync`. Utile pour les éléments visuels (timer,
 * animations) qui doivent freezer sur pause sans avoir à connaître la SM.
 *
 * @returns un disposer qui annule l'abonnement.
 */
export function onPauseChange(
  sync: MatchSyncAdapter,
  handler: (isPaused: boolean) => void,
): () => void {
  let lastValue: boolean | null = null;
  return sync.onEvent((event) => {
    if (event.type !== "match:state") return;
    const isPaused = event.status === "paused";
    if (lastValue === isPaused) return;
    lastValue = isPaused;
    handler(isPaused);
  });
}
