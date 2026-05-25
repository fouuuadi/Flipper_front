import { Button } from "@modules/ui";
import { gameStore } from "@core/gameStore";
import "./pause.css";

/**
 * Overlay de pause monté pendant l'état `paused` de la SM.
 *
 * UI-only — aucun endpoint back côté pause (cf. commentaire d'intégration #77).
 * Attention : la session backend reste vivante côté Redis avec TTL sliding
 * 30 min. Au-delà, la reprise échouera côté `POST /scores` avec 404.
 *
 * Le raccourci clavier "ESC → PAUSE" pendant l'état `playing` est de la
 * responsabilité du routeur (cf. follow-up sur main.ts), pas de ce composant.
 */
export class Pause {
  private readonly root: HTMLElement;
  private readonly resumeButton: Button;
  private readonly abandonButton: Button;
  private keyHandler: ((event: KeyboardEvent) => void) | null = null;

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
      onClick: () => gameStore.send({ type: "RESUME" }),
    });
    this.abandonButton = new Button({
      label: "Abandonner",
      variant: "ghost",
      onClick: () => gameStore.send({ type: "ABANDON" }),
    });
    this.resumeButton.mount(actions);
    this.abandonButton.mount(actions);
    card.appendChild(actions);
  }

  mount(host: HTMLElement = document.body): void {
    host.appendChild(this.root);
    this.keyHandler = (event) => {
      if (event.key === "Escape") {
        event.preventDefault();
        gameStore.send({ type: "RESUME" });
      }
    };
    window.addEventListener("keydown", this.keyHandler);
  }

  unmount(): void {
    if (this.keyHandler) {
      window.removeEventListener("keydown", this.keyHandler);
      this.keyHandler = null;
    }
    this.resumeButton.unmount();
    this.abandonButton.unmount();
    this.root.remove();
  }
}
