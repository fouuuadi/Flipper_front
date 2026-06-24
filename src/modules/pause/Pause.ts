import { Button } from "@modules/ui";
import { matchSync } from "@services/matchSync";
import "./pause.css";

/**
 * Overlay de pause monté pendant l'état `paused` de la SM.
 *
 * Les actions sont des **intentions** envoyées au backend via `cmd:resume` /
 * `cmd:abandon` sur le bus borne. L'écran ne bascule pas lui-même — il attend
 * que le backend rebroadcast `match:state` et que le follower applique la
 * transition (cf. `bindToGameStore`).
 *
 * Le raccourci clavier "ÉCHAP → PAUSE" en `playing` est routé par le
 * `KeyboardDispatcher` global, pas par ce composant.
 */
export class Pause {
  private readonly root: HTMLElement;
  private readonly resumeButton: Button;
  private readonly abandonButton: Button;
  // Curseur de navigation aux boutons : 0 = reprendre, 1 = abandonner.
  private cursor = 0;

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

  /** Déplace le curseur entre Reprendre (0) et Abandonner (1), avec bouclage. */
  moveCursor(delta: number): void {
    this.cursor = (((this.cursor + delta) % 2) + 2) % 2;
    this.resumeButton.setVariant(this.cursor === 0 ? "primary" : "ghost");
    this.abandonButton.setVariant(this.cursor === 1 ? "primary" : "ghost");
  }

  /** Valide l'option sous le curseur. */
  confirm(): void {
    if (this.cursor === 0) this.requestResume();
    else this.requestAbandon();
  }

  private requestResume(): void {
    matchSync.dispatch({ type: "cmd:resume" });
  }

  private requestAbandon(): void {
    matchSync.dispatch({ type: "cmd:abandon" });
  }
}
