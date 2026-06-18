import type { GameStore } from "@core/gameStore";
import type { MatchSyncAdapter } from "@services/matchSync";
import type { GameplayControls } from "./bindGameplayInput";

/**
 * Source borne du gameplay (flippers + lanceur), pendant prod de
 * {@link bindGameplayInput} (clavier en dev).
 *
 * Les boutons physiques de la borne sont publiés par l'ESP32 sur MQTT, relayés
 * par le backend sur le bus borne sous forme d'events `control:flipper` /
 * `control:plunger`. On les consomme exactement comme le clavier : mêmes
 * `controls`, même garde d'état.
 *
 * - `press` / `charge` n'agissent qu'en `playing` (presser un bouton au menu ne
 *   fait rien).
 * - `release` n'est **pas** gardé : on doit pouvoir relâcher un flipper même si
 *   l'état a changé pendant l'appui (sinon il resterait collé).
 *
 * @returns une fonction de cleanup qui se désabonne du bus.
 */
export function bindBorneGameplay(
  store: GameStore,
  controls: GameplayControls,
  sync: Pick<MatchSyncAdapter, "onEvent">,
): () => void {
  return sync.onEvent((event) => {
    if (event.type === "control:flipper" || event.type === "control:plunger") {
      // Log de diagnostic : confirme que l'écran reçoit bien l'entrée physique
      // relayée par le backend (à retirer une fois le câblage borne validé).
      console.info("[borne-input]", event);
    }
    switch (event.type) {
      case "control:flipper": {
        const flipper = event.side === "left" ? controls.leftFlipper : controls.rightFlipper;
        if (event.action === "press") {
          if (store.getState().value !== "playing") return;
          flipper.press();
        } else {
          flipper.release();
        }
        break;
      }
      case "control:plunger": {
        if (event.action === "charge") {
          if (store.getState().value !== "playing") return;
          controls.launcher.startCharge();
        } else {
          controls.launcher.release();
        }
        break;
      }
    }
  });
}
