import type { GameStore } from "@core/gameStore";
import type { Flipper } from "@modules/flipper/Flipper";
import type { Launcher } from "@modules/launcher/launcher";

export interface GameplayControls {
  readonly leftFlipper: Flipper;
  readonly rightFlipper: Flipper;
  readonly launcher: Launcher;
}

/**
 * Source unique du clavier gameplay (flippers + lanceur).
 *
 * - `keydown` n'agit **que** dans l'état `playing` : presser Shift/Espace au
 *   menu, au splash, etc. est ignoré.
 * - `keyup` n'est **pas** gardé par l'état : on doit pouvoir relâcher un flipper
 *   même si l'état a changé pendant l'appui (sinon il resterait collé).
 *
 * Une seule paire de listeners pour toute l'app (vs un couple par Flipper/Launcher
 * auparavant), montée une fois au boot.
 *
 * @returns une fonction de cleanup qui retire les listeners.
 */
export function bindGameplayInput(
  store: GameStore,
  controls: GameplayControls,
  target: EventTarget = window,
): () => void {
  const onKeyDown = (event: Event): void => {
    if (store.getState().value !== "playing") return;
    switch ((event as KeyboardEvent).code) {
      case "ShiftLeft":
        controls.leftFlipper.press();
        break;
      case "ShiftRight":
        controls.rightFlipper.press();
        break;
      case "Space":
        controls.launcher.startCharge();
        break;
    }
  };

  const onKeyUp = (event: Event): void => {
    switch ((event as KeyboardEvent).code) {
      case "ShiftLeft":
        controls.leftFlipper.release();
        break;
      case "ShiftRight":
        controls.rightFlipper.release();
        break;
      case "Space":
        controls.launcher.release();
        break;
    }
  };

  target.addEventListener("keydown", onKeyDown);
  target.addEventListener("keyup", onKeyUp);

  return () => {
    target.removeEventListener("keydown", onKeyDown);
    target.removeEventListener("keyup", onKeyUp);
  };
}
