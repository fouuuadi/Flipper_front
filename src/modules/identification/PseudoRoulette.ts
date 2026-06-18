import "./pseudoRoulette.css";

// Caractères sélectionnables : alphanumérique majuscule, conforme au pattern
// pseudo (`[A-Za-z0-9]{3}`, cf. validation.ts).
export const ROULETTE_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
export const ROULETTE_LENGTH = 3;

/**
 * Modèle pur de la roulette de saisie (sans DOM, donc testable) : N slots, un
 * curseur, navigation gauche/droite (change le caractère) et confirm/back
 * (avance/recule le curseur).
 */
export class PseudoRouletteModel {
  private readonly slots: number[];
  private cursor = 0;

  constructor(
    private readonly length = ROULETTE_LENGTH,
    private readonly alphabet = ROULETTE_ALPHABET,
  ) {
    this.slots = new Array(length).fill(0);
  }

  get cursorIndex(): number {
    return this.cursor;
  }

  get pseudo(): string {
    return this.slots.map((i) => this.alphabet[i]).join("");
  }

  charAt(slot: number): string {
    return this.alphabet[this.slots[slot]];
  }

  /** Fait défiler le caractère du slot courant (avec bouclage). */
  moveChar(delta: number): void {
    const n = this.alphabet.length;
    this.slots[this.cursor] = (((this.slots[this.cursor] + delta) % n) + n) % n;
  }

  /** Avance le curseur. Retourne `true` si le pseudo est complet (dernier slot). */
  confirm(): boolean {
    if (this.cursor < this.length - 1) {
      this.cursor += 1;
      return false;
    }
    return true;
  }

  /** Recule le curseur. Retourne `true` si on était déjà au 1er slot (→ annuler). */
  back(): boolean {
    if (this.cursor > 0) {
      this.cursor -= 1;
      return false;
    }
    return true;
  }
}

export interface PseudoRouletteOptions {
  /** Pseudo complet validé (les N caractères saisis). */
  readonly onComplete: (pseudo: string) => void;
  /** `back` déclenché alors que le curseur est sur le 1er slot. */
  readonly onCancel: () => void;
}

/**
 * Roulette de saisie du pseudo aux boutons (style borne d'arcade). Pilotée par
 * `moveChar` / `confirm` / `back` (branchés sur les boutons borne + flèches en
 * dev). Le rendu DOM surligne le slot courant.
 */
export class PseudoRoulette {
  private readonly model = new PseudoRouletteModel();
  private readonly root: HTMLElement;
  private readonly slotEls: HTMLElement[] = [];

  constructor(private readonly options: PseudoRouletteOptions) {
    this.root = document.createElement("div");
    this.root.className = "pseudo-roulette";

    for (let i = 0; i < ROULETTE_LENGTH; i += 1) {
      const slot = document.createElement("div");
      slot.className = "pseudo-roulette-slot";
      this.root.appendChild(slot);
      this.slotEls.push(slot);
    }

    const hint = document.createElement("p");
    hint.className = "pseudo-roulette-hint";
    hint.textContent = "← → choisir · vert valider · rouge effacer";
    this.root.appendChild(hint);

    this.render();
  }

  mount(host: HTMLElement): void {
    host.appendChild(this.root);
  }

  unmount(): void {
    this.root.remove();
  }

  moveChar(delta: number): void {
    this.model.moveChar(delta);
    this.render();
  }

  confirm(): void {
    if (this.model.confirm()) {
      this.options.onComplete(this.model.pseudo);
    } else {
      this.render();
    }
  }

  back(): void {
    if (this.model.back()) {
      this.options.onCancel();
    } else {
      this.render();
    }
  }

  private render(): void {
    this.slotEls.forEach((el, i) => {
      el.textContent = this.model.charAt(i);
      el.classList.toggle("pseudo-roulette-slot--active", i === this.model.cursorIndex);
    });
  }
}
