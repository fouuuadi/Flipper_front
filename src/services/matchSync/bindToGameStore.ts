import type { GameStore } from "@core/gameStore";
import type { GameStateValue } from "@core/gameMachine.types";
import type { MatchSyncAdapter } from "./MatchSyncAdapter";
import type { BorneNav, MatchStatus, WsServerEvent } from "./protocol";

/**
 * Branche le bus borne sur la state machine front en mode **follower** :
 * le backend décide, le front applique.
 *
 *   - `nav:state`   → impose la phase de navigation (splash/menu/identification/
 *                     boutique/settings/leaderboard/in_game/game_over).
 *   - `match:state` → affine la sous-phase de jeu (playing/paused/gameOver)
 *                     pendant `in_game`.
 *
 * Les autres events (`countdown:tick`, `score:update`, `ball:lost`,
 * `game:over`) sont laissés aux consommateurs spécialisés (overlay countdown,
 * HUD backglass, DMD) qui s'abonnent eux-mêmes via `onEvent`.
 *
 * Mapping centralisé ici → importé par les 3 apps via cette unique fonction,
 * donc aucune divergence possible entre écrans.
 *
 * @returns une fonction d'unsubscribe — à appeler dans le teardown.
 */
export function bindMatchSyncToGameStore(sync: MatchSyncAdapter, store: GameStore): () => void {
  return sync.onEvent((event) => handleEvent(event, store));
}

const NAV_TO_STATE: Record<BorneNav, GameStateValue> = {
  splash: "splash",
  menu: "menu",
  identification: "identification",
  boutique: "cosmetics",
  settings: "settings",
  leaderboard: "leaderboard",
  in_game: "playing",
  game_over: "gameOver",
};

// Sous-états de la phase de jeu. `waiting` est ignoré ; `ready` ramène en
// `playing` pour quitter la pause dès le resume (le countdown s'affiche en
// overlay par-dessus).
const MATCH_TO_STATE: Partial<Record<MatchStatus, GameStateValue>> = {
  ready: "playing",
  playing: "playing",
  paused: "paused",
  over: "gameOver",
};

const GAME_PHASES: ReadonlySet<GameStateValue> = new Set<GameStateValue>([
  "playing",
  "paused",
  "gameOver",
]);

function handleEvent(event: WsServerEvent, store: GameStore): void {
  if (event.type === "nav:state") {
    store.applyServerState(NAV_TO_STATE[event.nav], { sessionId: event.sessionId });
    return;
  }

  if (event.type === "match:state") {
    const target = MATCH_TO_STATE[event.status];
    if (!target) return; // `waiting` → no-op
    // Les events match ne s'appliquent que pendant une phase de jeu ; cette
    // phase est établie au préalable par `nav:state: in_game`.
    if (!GAME_PHASES.has(store.getState().value)) return;
    store.applyServerState(target, { sessionId: event.sessionId });
    return;
  }

  // countdown:tick / score:update / ball:lost / game:over → consommés ailleurs.
}
