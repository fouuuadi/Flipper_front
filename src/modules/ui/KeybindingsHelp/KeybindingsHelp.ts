import {
  ANY_KEY,
  bindingsForState,
  helpModalState,
  type KeyBinding,
} from "@core/keyboardDispatcher";
import type { GameStore } from "@core/gameStore";
import type { GameStateValue } from "@core/gameMachine.types";

import "./keybindings-help.css";

export interface KeybindingsHelpOptions {
  readonly store: GameStore;
  /** Hôte du portail DOM (défaut `document.body`). */
  readonly host?: HTMLElement;
  /** Cible des `keydown` (défaut `window`). Injectable pour les tests. */
  readonly target?: EventTarget;
}

/**
 * Overlay d'aide listant les raccourcis clavier de l'état SM courant.
 *
 * - Toggle sur `?` (`Shift+/` sur QWERTY, `Shift+,` sur AZERTY — `event.key`
 *   vaut `?` dans les 2 cas).
 * - Ferme aussi sur `Escape`.
 * - Tant que la modal est ouverte, signale au `KeyboardDispatcher` qu'il
 *   doit court-circuiter le routage clavier (via `helpModalState`).
 * - Re-rend si l'état SM change pendant qu'elle est ouverte (cas marginal
 *   mais propre).
 */
export class KeybindingsHelp {
  private readonly host: HTMLElement;
  private readonly target: EventTarget;
  private readonly store: GameStore;
  private readonly listener: (event: Event) => void;
  private root: HTMLElement | null = null;
  private listEl: HTMLElement | null = null;
  private titleEl: HTMLElement | null = null;
  private storeUnsubscribe: (() => void) | null = null;
  private started = false;

  constructor(options: KeybindingsHelpOptions) {
    this.store = options.store;
    this.host =
      options.host ?? (typeof document !== "undefined" ? document.body : ({} as HTMLElement));
    this.target = options.target ?? (typeof window !== "undefined" ? window : new EventTarget());
    this.listener = (event) => this.onKeydown(event as KeyboardEvent);
  }

  start(): void {
    if (this.started) return;
    this.target.addEventListener("keydown", this.listener);
    this.started = true;
  }

  stop(): void {
    if (!this.started) return;
    this.target.removeEventListener("keydown", this.listener);
    this.close();
    this.started = false;
  }

  isOpen(): boolean {
    return this.root !== null;
  }

  open(): void {
    if (this.isOpen()) return;
    helpModalState.open();
    this.mount();
    this.render();
    // Si l'état SM change pendant que la modal est ouverte (rare mais possible :
    // un broadcast back `match:state` arrive), on rerender la liste.
    this.storeUnsubscribe = this.store.subscribe(() => this.render());
  }

  close(): void {
    if (!this.isOpen()) return;
    helpModalState.close();
    this.storeUnsubscribe?.();
    this.storeUnsubscribe = null;
    this.root?.remove();
    this.root = null;
    this.listEl = null;
    this.titleEl = null;
  }

  private onKeydown(event: KeyboardEvent): void {
    if (isEditableTarget(event.target)) return;
    if (event.key === "?") {
      event.preventDefault();
      if (this.isOpen()) this.close();
      else this.open();
      return;
    }
    if (event.key === "Escape" && this.isOpen()) {
      event.preventDefault();
      this.close();
    }
  }

  private mount(): void {
    const root = document.createElement("section");
    root.className = "keybindings-help-scene";
    root.setAttribute("role", "dialog");
    root.setAttribute("aria-modal", "true");
    root.setAttribute("aria-labelledby", "keybindings-help-title");

    const card = document.createElement("div");
    card.className = "keybindings-help-card";

    const title = document.createElement("h2");
    title.id = "keybindings-help-title";
    title.className = "keybindings-help-title";
    title.textContent = "Raccourcis clavier";
    card.appendChild(title);
    this.titleEl = title;

    const list = document.createElement("dl");
    list.className = "keybindings-help-list";
    card.appendChild(list);
    this.listEl = list;

    const hint = document.createElement("p");
    hint.className = "keybindings-help-hint";
    hint.innerHTML = "Appuyer sur <kbd>?</kbd> ou <kbd>Échap</kbd> pour fermer";
    card.appendChild(hint);

    root.appendChild(card);
    this.host.appendChild(root);
    this.root = root;
  }

  private render(): void {
    if (!this.listEl || !this.titleEl) return;
    const state = this.store.getState().value;
    this.titleEl.textContent = `Raccourcis · ${stateLabel(state)}`;

    this.listEl.innerHTML = "";
    const bindings = bindingsForState(state);
    if (bindings.length === 0) {
      const empty = document.createElement("p");
      empty.className = "keybindings-help-empty";
      empty.textContent = "Aucun raccourci disponible dans cet écran.";
      this.listEl.appendChild(empty);
      return;
    }

    for (const b of bindings) {
      this.listEl.appendChild(buildRow(b));
    }
  }
}

function buildRow(binding: KeyBinding): DocumentFragment {
  const frag = document.createDocumentFragment();

  const dt = document.createElement("dt");
  dt.className = "keybindings-help-key";
  const kbd = document.createElement("kbd");
  kbd.textContent = displayKey(binding.key);
  dt.appendChild(kbd);
  frag.appendChild(dt);

  const dd = document.createElement("dd");
  dd.className = "keybindings-help-label";
  dd.textContent = binding.label;
  frag.appendChild(dd);

  return frag;
}

function displayKey(key: string): string {
  if (key === ANY_KEY) return "n'importe";
  if (key === " ") return "Espace";
  if (key === "Escape") return "Échap";
  if (key === "Enter") return "Entrée";
  if (key.length === 1) return key.toUpperCase();
  return key;
}

function stateLabel(state: GameStateValue): string {
  switch (state) {
    case "splash":
      return "Accueil";
    case "menu":
      return "Menu";
    case "identification":
      return "Identification";
    case "playing":
      return "En partie";
    case "paused":
      return "Pause";
    case "gameOver":
      return "Fin de partie";
    case "leaderboard":
      return "Classement";
  }
}

function isEditableTarget(target: EventTarget | null): boolean {
  if (!target) return false;
  const tag = (target as { tagName?: unknown }).tagName;
  if (typeof tag === "string") {
    if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return true;
  }
  const editable = (target as { isContentEditable?: unknown }).isContentEditable;
  return editable === true;
}
