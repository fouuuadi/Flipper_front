import { Button } from "@modules/ui";
import { gameStore } from "@core/gameStore";
import { matchSync } from "@services/matchSync";
import { dispatchIntent } from "@core/keyboardDispatcher";
import "./pause.css";

/**
 * Le raccourci clavier "ÉCHAP → PAUSE" en `playing` est routé par le
 * `KeyboardDispatcher` global, pas par ce composant.
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
    // Le raccourci ÉCHAP, RESUME est désormais routé
  }

  unmount(): void {
    this.resumeButton.unmount();
    this.abandonButton.unmount();
    this.root.remove();
  }

  private requestResume(): void {
    dispatchIntent({ type: "RESUME" }, { sync: matchSync, store: gameStore });
  }

  private requestAbandon(): void {
    dispatchIntent({ type: "ABANDON" }, { sync: matchSync, store: gameStore });
  }
}
