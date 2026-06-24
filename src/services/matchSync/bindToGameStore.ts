import type { GameStore } from "@core/gameStore";
import type { GameStateValue, Player, PlayerTag } from "@core/gameMachine.types";
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
 * Les données gameplay (`score:update`, `ball:lost`, `game:over`) sont aussi
 * reflétées dans le contexte joueur du gameStore. Les consommateurs spécialisés
 * (HUD backglass, DMD) restent abonnés directement pour leurs animations.
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

  if (event.type === "session:snapshot") {
    const players: Player[] = event.players.filter(isPlayerTag).map((tag, index) => ({
      tag,
      score: index === 0 ? event.score : 0,
      ballsRemaining: event.lives,
    }));
    store.applyServerState(store.getState().value, {
      sessionId: event.sessionId,
      mode: event.mode,
      players,
      currentBall: Math.max(1, 4 - event.lives),
    });
    return;
  }

  if (event.type === "score:update") {
    patchFirstPlayer(store, { score: event.score });
    return;
  }

  if (event.type === "ball:lost") {
    patchFirstPlayer(store, { ballsRemaining: event.livesRemaining });
    return;
  }

  if (event.type === "game:over") {
    patchFirstPlayer(store, { score: event.finalScore, ballsRemaining: 0 });
    return;
  }

  // countdown:tick → consommé par les overlays dédiés.
}

function isPlayerTag(value: string): value is PlayerTag {
  return value.includes("#");
}

function patchFirstPlayer(
  store: GameStore,
  patch: Partial<Pick<Player, "score" | "ballsRemaining">>,
): void {
  const snapshot = store.getState();
  const first = snapshot.context.players[0];
  if (!first) return;
  store.applyServerState(snapshot.value, {
    players: [{ ...first, ...patch }, ...snapshot.context.players.slice(1)],
  });
}
