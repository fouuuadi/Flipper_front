import {
  assemblePseudo,
  decomposePseudo,
  HASHTAG_LENGTH,
  normalizeChar,
  PSEUDO_LENGTH,
  shouldAdvanceAfterInput,
  shouldRetreatOnBackspace,
  TOTAL_BOXES,
} from "./pseudoInputLogic";

import "./pseudo-input.css";

export interface PseudoInputOptions {
  readonly label?: string;
  readonly value?: string;
  readonly onInput?: (value: string) => void;
  readonly onSubmit?: (value: string) => void;
}

/**
 * Champ de saisie pseudo en 8 cases : `[X][X][X] # [X][X][X][X][X]`.
 *
 * - `#` figé au milieu, non éditable.
 * - Chaque case = 1 caractère alphanumérique, auto-uppercase, max 1 char.
 * - Saisie : auto-advance vers la case suivante quand on tape.
 * - Backspace : efface la case courante. Si déjà vide, recule au précédent.
 * - Enter : déclenche `onSubmit(value)` avec la valeur assemblée
 *   ("ABC", "ABC#XYZ12" ou "ABC#XY" pour partiel — la validation rejettera
 *   ce dernier cas).
 * - Paste : redistribue la chaîne collée sur les cases (ex: paste "ABC#XYZ12"
 *   remplit tout ; paste "AB" remplit les 2 premières).
 *
 * Format aligné sur le contrat back `^[A-Za-z0-9]{3}(#[A-Za-z0-9]{5})?$`,
 * et anticipe la saisie via boutons arcade (3+5 = 8 actions, pas un clavier
 * complet — cf. follow-up dans PR #104).
 */
export class PseudoInput {
  private readonly root: HTMLLabelElement;
  private readonly fieldEl: HTMLElement;
  private readonly errorEl: HTMLSpanElement;
  private readonly boxes: HTMLInputElement[] = [];
  private readonly onInputCb: ((value: string) => void) | null;
  private readonly onSubmitCb: ((value: string) => void) | null;
  private readonly listeners: Array<() => void> = [];

  constructor(options: PseudoInputOptions = {}) {
    this.onInputCb = options.onInput ?? null;
    this.onSubmitCb = options.onSubmit ?? null;

    this.root = document.createElement("label");
    this.root.className = "ui-pseudo";

    if (options.label) {
      const labelEl = document.createElement("span");
      labelEl.className = "ui-pseudo__label";
      labelEl.textContent = options.label;
      this.root.appendChild(labelEl);
    }

    this.fieldEl = document.createElement("div");
    this.fieldEl.className = "ui-pseudo__field";
    this.root.appendChild(this.fieldEl);

    // 3 cases pseudo
    for (let i = 0; i < PSEUDO_LENGTH; i += 1) {
      this.boxes.push(this.buildBox(i, "ui-pseudo__box--pseudo"));
    }

    // Séparateur # figé
    const sep = document.createElement("span");
    sep.className = "ui-pseudo__sep";
    sep.setAttribute("aria-hidden", "true");
    sep.textContent = "#";
    this.fieldEl.appendChild(sep);

    // 5 cases hashtag
    for (let i = PSEUDO_LENGTH; i < TOTAL_BOXES; i += 1) {
      this.boxes.push(this.buildBox(i, "ui-pseudo__box--hashtag"));
    }

    this.errorEl = document.createElement("span");
    this.errorEl.className = "ui-pseudo__error";
    this.errorEl.setAttribute("aria-live", "polite");
    this.root.appendChild(this.errorEl);

    if (options.value) this.setValue(options.value);
  }

  mount(parent: HTMLElement): void {
    parent.appendChild(this.root);
  }

  unmount(): void {
    for (const cleanup of this.listeners) cleanup();
    this.listeners.length = 0;
    this.root.remove();
  }

  focus(): void {
    // Focus la 1re case vide, sinon la dernière case du pseudo.
    const firstEmpty = this.boxes.findIndex((b) => b.value === "");
    const target = firstEmpty >= 0 ? firstEmpty : PSEUDO_LENGTH - 1;
    this.boxes[target]?.focus();
  }

  getValue(): string {
    return assemblePseudo(this.boxes.map((b) => b.value));
  }

  setValue(value: string): void {
    const decomposed = decomposePseudo(value);
    for (let i = 0; i < TOTAL_BOXES; i += 1) {
      this.boxes[i].value = decomposed[i] ?? "";
    }
    this.onInputCb?.(this.getValue());
  }

  setError(message: string | null): void {
    if (message) {
      this.root.classList.add("ui-pseudo--error");
      this.errorEl.textContent = message;
    } else {
      this.root.classList.remove("ui-pseudo--error");
      this.errorEl.textContent = "";
    }
  }

  setDisabled(disabled: boolean): void {
    for (const box of this.boxes) box.disabled = disabled;
  }

  // ─── internals ──────────────────────────────────────────────────────────

  private buildBox(index: number, sectionClass: string): HTMLInputElement {
    const input = document.createElement("input");
    input.type = "text";
    input.className = `ui-pseudo__box ${sectionClass}`;
    input.maxLength = 1;
    input.autocomplete = "off";
    input.spellcheck = false;
    input.setAttribute("aria-label", this.ariaLabelForIndex(index));
    input.inputMode = "text";

    const inputHandler = (event: Event) => this.onBoxInput(event, index);
    const keyHandler = (event: KeyboardEvent) => this.onBoxKeydown(event, index);
    const pasteHandler = (event: ClipboardEvent) => this.onBoxPaste(event, index);

    input.addEventListener("input", inputHandler);
    input.addEventListener("keydown", keyHandler);
    input.addEventListener("paste", pasteHandler);

    this.listeners.push(() => {
      input.removeEventListener("input", inputHandler);
      input.removeEventListener("keydown", keyHandler);
      input.removeEventListener("paste", pasteHandler);
    });

    this.fieldEl.appendChild(input);
    return input;
  }

  private ariaLabelForIndex(index: number): string {
    if (index < PSEUDO_LENGTH) return `Pseudo, caractère ${index + 1} sur ${PSEUDO_LENGTH}`;
    const hashIdx = index - PSEUDO_LENGTH + 1;
    return `Hashtag, caractère ${hashIdx} sur ${HASHTAG_LENGTH}`;
  }

  private onBoxInput(event: Event, index: number): void {
    const target = event.target as HTMLInputElement;
    const raw = target.value;
    // L'event "input" peut contenir plusieurs caractères (autocomplete,
    // composition…). On garde uniquement le dernier valide.
    const lastChar = raw.length > 0 ? raw[raw.length - 1] : "";
    const normalized = normalizeChar(lastChar);
    const wasEmpty =
      target.dataset.previousValue === "" || target.dataset.previousValue === undefined;
    if (normalized === null) {
      target.value = "";
    } else {
      target.value = normalized;
    }
    target.dataset.previousValue = target.value;

    this.onInputCb?.(this.getValue());

    if (shouldAdvanceAfterInput(wasEmpty, target.value.length === 1)) {
      this.focusBox(index + 1);
    }
  }

  private onBoxKeydown(event: KeyboardEvent, index: number): void {
    const target = event.target as HTMLInputElement;

    if (event.key === "Enter") {
      event.preventDefault();
      this.onSubmitCb?.(this.getValue());
      return;
    }

    if (event.key === "Backspace") {
      if (shouldRetreatOnBackspace(target.value)) {
        event.preventDefault();
        this.focusBox(index - 1);
        const prev = this.boxes[index - 1];
        if (prev) {
          prev.value = "";
          prev.dataset.previousValue = "";
          this.onInputCb?.(this.getValue());
        }
      }
      // Sinon, la touche fait son boulot classique (efface le caractère).
      return;
    }

    if (event.key === "ArrowLeft") {
      event.preventDefault();
      this.focusBox(index - 1);
      return;
    }

    if (event.key === "ArrowRight") {
      event.preventDefault();
      this.focusBox(index + 1);
      return;
    }

    // Bloque les caractères invalides AVANT qu'ils n'arrivent dans l'input
    // (sinon "input" event recevrait du junk à filtrer).
    if (event.key.length === 1 && !event.metaKey && !event.ctrlKey && !event.altKey) {
      if (normalizeChar(event.key) === null) {
        event.preventDefault();
      }
    }
  }

  private onBoxPaste(event: ClipboardEvent, index: number): void {
    event.preventDefault();
    const pasted = event.clipboardData?.getData("text") ?? "";
    if (pasted.length === 0) return;

    // Cas commun : on colle un pseudo complet ("ABC#XYZ12") → redistribue
    // depuis le début, pas depuis la case courante.
    const looksComplete = pasted.includes("#") || pasted.length >= PSEUDO_LENGTH;
    if (looksComplete) {
      this.setValue(pasted);
      this.focus();
      return;
    }

    // Cas court : on remplit à partir de la case courante.
    let cursor = index;
    for (const ch of pasted) {
      if (cursor >= TOTAL_BOXES) break;
      const norm = normalizeChar(ch);
      if (norm === null) continue;
      this.boxes[cursor].value = norm;
      this.boxes[cursor].dataset.previousValue = norm;
      cursor += 1;
    }
    this.focusBox(cursor);
    this.onInputCb?.(this.getValue());
  }

  private focusBox(index: number): void {
    const clamped = Math.max(0, Math.min(TOTAL_BOXES - 1, index));
    const box = this.boxes[clamped];
    if (!box) return;
    box.focus();
    // Place le curseur en fin de case pour que la frappe suivante remplace
    // le caractère plutôt que de l'insérer avant.
    const len = box.value.length;
    try {
      box.setSelectionRange(len, len);
    } catch {
      // certains types d'input rejettent setSelectionRange — ignorable.
    }
  }
}
