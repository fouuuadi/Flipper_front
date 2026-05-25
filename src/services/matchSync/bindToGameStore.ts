import type { GameStore } from "@core/gameStore";
import type { MatchSyncAdapter } from "./MatchSyncAdapter";
import type { WsServerEvent } from "./protocol";

/**
 * Branche les events `match:state` reçus sur la state machine front locale.
 *
 * Seules les transitions de **phase 2 (partie en cours)** sont synchronisées
 * via le back :
 *   - `match:state: paused`  (depuis playing) → PAUSE
 *   - `match:state: playing` (depuis paused)  → RESUME
 *   - `match:state: over`    (depuis playing|paused) → GAME_OVER
 *
 * Les états `waiting` / `ready` sont broadcastés par le back mais **ignorés
 * ici** : la transition `identification → playing` est gérée localement
 * par l'écran identification (immédiate après ready_up, le countdown qui
 * suit est purement visuel).
 *
 * Les autres events (`countdown:tick`, `score:update`, `ball:lost`,
 * `game:over`) sont laissés aux consommateurs spécialisés (overlay
 * countdown, HUD, backglass, DMD) qui s'abonnent eux-mêmes à `onEvent`.
 *
 * @returns une fonction d'unsubscribe — à appeler dans le teardown.
 */
export function bindMatchSyncToGameStore(sync: MatchSyncAdapter, store: GameStore): () => void {
  return sync.onEvent((event) => handleEvent(event, store));
}

function handleEvent(event: WsServerEvent, store: GameStore): void {
  if (event.type !== "match:state") return;

  const current = store.getState().value;

  if (event.status === "paused" && current === "playing") {
    store.send({ type: "PAUSE" });
    return;
  }

  if (event.status === "playing" && current === "paused") {
    store.send({ type: "RESUME" });
    return;
  }

  if (event.status === "over" && (current === "playing" || current === "paused")) {
    store.send({ type: "GAME_OVER" });
    return;
  }

  // Toutes les autres combinaisons (ready, waiting, doublons) → no-op.
}
