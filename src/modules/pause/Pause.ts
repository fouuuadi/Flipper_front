import { Button } from "@modules/ui";
import { gameStore } from "@core/gameStore";
import { matchSync } from "@services/matchSync";
import "./pause.css";

/**
 * Overlay de pause monté pendant l'état `paused` de la SM.
 *
 * En **mode solo** (sessionId présent), les actions sont des **intentions**
 * envoyées au back via `cmd:resume` / `cmd:abandon`. L'écran ne bascule pas
 * lui-même — il attend que le back broadcast `match:state` et que le bind
 * helper applique la transition à la SM (cf. `bindToGameStore`).
 *
 * En **mode 1v1 mock** (pas de sessionId, matchmaking back pas dispo),
 * fallback à `gameStore.send` direct.
 *
 * Le raccourci clavier "ESC → PAUSE" pendant l'état `playing` est de la
 * responsabilité du routeur (futur `src/main.ts`), pas de ce composant.
 */
export class Pause {
  private readonly root: HTMLElement;
  private readonly resumeButton: Button;
  private readonly abandonButton: Button;

  constructor() {
    this.root = document.createElement("section");
    this.root.className = "pause-scene";
    this.root.setAttribute("role", "dialog");
    this.root.setAttribute("aria-modal", "true");
    this.root.setAttribute("aria-labelledby", "pause-title");

    const card = document.createElement("div");
    card.className = "pause-card";
    this.root.appendChild(card);

    const title = document.createElement("h1");
    title.id = "pause-title";
    title.className = "pause-title";
    title.textContent = "Pause";
    card.appendChild(title);

    const hint = document.createElement("p");
    hint.className = "pause-hint";
    hint.textContent = "Appuyer sur ÉCHAP pour reprendre";
    card.appendChild(hint);

    const actions = document.createElement("div");
    actions.className = "pause-actions";
    this.resumeButton = new Button({
      label: "Reprendre",
      variant: "primary",
      onClick: () => this.requestResume(),
    });
    this.abandonButton = new Button({
      label: "Abandonner",
      variant: "ghost",
      onClick: () => this.requestAbandon(),
    });
    this.resumeButton.mount(actions);
    this.abandonButton.mount(actions);
    card.appendChild(actions);
  }

  mount(host: HTMLElement = document.body): void {
    host.appendChild(this.root);
    // Le raccourci ÉCHAP → RESUME est désormais routé par le
    // `KeyboardDispatcher` global (cf. `core/keyboardDispatcher/bindings.ts`).
  }

  unmount(): void {
    this.resumeButton.unmount();
    this.abandonButton.unmount();
    this.root.remove();
  }

  private requestResume(): void {
    if (gameStore.getState().context.sessionId) {
      matchSync.dispatch({ type: "cmd:resume" });
    } else {
      gameStore.send({ type: "RESUME" });
    }
  }

  private requestAbandon(): void {
    if (gameStore.getState().context.sessionId) {
      matchSync.dispatch({ type: "cmd:abandon" });
    } else {
      gameStore.send({ type: "ABANDON" });
    }
  }
}
