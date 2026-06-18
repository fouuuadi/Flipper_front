import type { GameEvent } from "@core/gameMachine.types";
import type { MatchSyncAdapter, NavAction } from "@services/matchSync";

export interface DispatchIntentDeps {
  readonly sync: Pick<MatchSyncAdapter, "dispatch">;
}

/**
 * Route une intention utilisateur (touche clavier, bouton…) vers le **backend**,
 * qui est désormais le seul décideur. Le front ne mute plus jamais son store
 * localement : il attend le `nav:state` / `match:state` rebroadcasté.
 *
 *   - `PAUSE` / `RESUME` / `ABANDON` → `cmd:*` (contrôles de match).
 *   - navigation (`PRESS_A`, `START_GAME`, `OPEN_*`, `BACK_TO_MENU`, `REPLAY`)
 *     → `intent` avec l'action correspondante.
 *
 * `PLAYERS_VALIDATED` (qui porte un payload pseudo/mode) est dispatché
 * directement par l'écran d'identification, pas via cette fonction clavier.
 */
const NAV_ACTIONS: Partial<Record<GameEvent["type"], NavAction>> = {
  PRESS_A: "PRESS_A",
  START_GAME: "START_GAME",
  OPEN_LEADERBOARD: "OPEN_LEADERBOARD",
  OPEN_COSMETICS: "OPEN_BOUTIQUE",
  OPEN_SETTINGS: "OPEN_SETTINGS",
  BACK_TO_SPLASH: "BACK_TO_SPLASH",
  BACK_TO_MENU: "BACK_TO_MENU",
  REPLAY: "REPLAY",
};

export function dispatchIntent(event: GameEvent, deps: DispatchIntentDeps): void {
  switch (event.type) {
    case "PAUSE":
      deps.sync.dispatch({ type: "cmd:pause" });
      return;
    case "RESUME":
      deps.sync.dispatch({ type: "cmd:resume" });
      return;
    case "ABANDON":
      deps.sync.dispatch({ type: "cmd:abandon" });
      return;
  }

  const action = NAV_ACTIONS[event.type];
  if (action) {
    deps.sync.dispatch({ type: "intent", action });
    return;
  }

  // Events locaux non routables au clavier (SET_FINAL_DURATION, PLAYERS_VALIDATED).
  if (import.meta.env.DEV) {
    console.warn(`[dispatchIntent] event non routable vers le backend: ${event.type}`);
  }
}
