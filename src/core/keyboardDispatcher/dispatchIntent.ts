import type { GameStore } from "@core/gameStore";
import type { GameEvent } from "@core/gameMachine.types";
import type { MatchSyncAdapter } from "@services/matchSync";

export interface DispatchIntentDeps {
  readonly store: Pick<GameStore, "getState" | "send">;
  readonly sync: Pick<MatchSyncAdapter, "dispatch">;
}

/**
 * Route une intention utilisateur (touche clavier, bouton…) vers la bonne
 * destination :
 *
 *   - `PAUSE` / `RESUME` / `ABANDON` **avec** session back → dispatch
 *     `cmd:*` sur le WS matchSync. Le back broadcastera `match:state` et
 *     `bindMatchSyncToGameStore` se chargera d'appliquer la transition à
 *     la SM. Ne touche pas directement à `gameStore` dans ce cas, pour
 *     éviter la double-transition.
 *   - Tous les autres events (ou les mêmes hors session, ex: 1v1 mock) →
 *     `gameStore.send` direct.
 *
 * Centralisé ici pour que le `KeyboardDispatcher` et l'overlay `Pause`
 * partagent exactement la même logique de routage.
 */
export function dispatchIntent(event: GameEvent, deps: DispatchIntentDeps): void {
  const sessionId = deps.store.getState().context.sessionId;

  if (sessionId !== null) {
    if (event.type === "PAUSE") {
      deps.sync.dispatch({ type: "cmd:pause" });
      return;
    }
    if (event.type === "RESUME") {
      deps.sync.dispatch({ type: "cmd:resume" });
      return;
    }
    if (event.type === "ABANDON") {
      deps.sync.dispatch({ type: "cmd:abandon" });
      return;
    }
  }

  deps.store.send(event);
}
