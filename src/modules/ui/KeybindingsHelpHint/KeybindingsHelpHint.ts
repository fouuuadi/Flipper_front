import { helpModalState } from "@core/keyboardDispatcher";
import type { GameStore } from "@core/gameStore";
import type { GameStateValue } from "@core/gameMachine.types";

import "./keybindings-help-hint.css";

/**
 * États SM pendant lesquels le hint est caché.
 *
 * - `playing` : la 3D du playfield prend tout l'écran, on évite tout overlay
 *   parasite. Le joueur connait déjà Échap pour la pause s'il a lu l'aide
 *   au moins une fois.
 *
 * Tous les autres écrans gardent le hint visible — il sert justement à faire
 * découvrir la modal d'aide à un nouvel utilisateur.
 */
const HIDDEN_STATES: ReadonlySet<GameStateValue> = new Set(["playing"]);

export interface KeybindingsHelpHintOptions {
  readonly store: GameStore;
  /** Hôte du portail DOM (défaut `document.body`). */
  readonly host?: HTMLElement;
}

/**
 * Indicateur visuel discret (`[?] Raccourcis`) affiché en bas à droite de
 * l'écran pour faire découvrir la modal d'aide clavier.
 *
 * - Visible sur la majorité des écrans (splash, menu, identification, paused,
 *   gameOver, leaderboard).
 * - Caché en `playing` (3D pleine page) et tant que la modal `?` est ouverte.
 * - Une seule instance globale attendue, montée au boot dans `src/main.ts`
 *   en parallèle de `KeybindingsHelp` et du `KeyboardDispatcher`.
 *
 * Note UX : c'est un palliatif tant qu'aucun tutoriel d'onboarding n'est
 * implémenté. Une fois que les utilisateurs connaissent l'app, on pourrait
 * envisager une option pour le masquer (cf. CLAUDE.md §11 — config user).
 */
export class KeybindingsHelpHint {
  private readonly host: HTMLElement;
  private readonly store: GameStore;
  private root: HTMLElement | null = null;
  private unsubscribeStore: (() => void) | null = null;
  private unsubscribeModal: (() => void) | null = null;
  private started = false;

  constructor(options: KeybindingsHelpHintOptions) {
    this.store = options.store;
    this.host =
      options.host ?? (typeof document !== "undefined" ? document.body : ({} as HTMLElement));
  }

  start(): void {
    if (this.started) return;
    this.mount();
    this.unsubscribeStore = this.store.subscribe(() => this.applyVisibility());
    this.unsubscribeModal = helpModalState.subscribe(() => this.applyVisibility());
    this.applyVisibility();
    this.started = true;
  }

  stop(): void {
    if (!this.started) return;
    this.unsubscribeStore?.();
    this.unsubscribeStore = null;
    this.unsubscribeModal?.();
    this.unsubscribeModal = null;
    this.root?.remove();
    this.root = null;
    this.started = false;
  }

  /** Exposé pour les tests : indique si le hint est actuellement visible. */
  isVisible(): boolean {
    return this.root !== null && !this.root.classList.contains("keybindings-help-hint--hidden");
  }

  private mount(): void {
    const root = document.createElement("div");
    root.className = "keybindings-help-hint";
    root.setAttribute("aria-hidden", "true");

    const kbd = document.createElement("kbd");
    kbd.className = "keybindings-help-hint__key";
    kbd.textContent = "?";

    const label = document.createElement("span");
    label.className = "keybindings-help-hint__label";
    label.textContent = "Raccourcis";

    root.appendChild(kbd);
    root.appendChild(label);

    this.host.appendChild(root);
    this.root = root;
  }

  private applyVisibility(): void {
    if (!this.root) return;
    const state = this.store.getState().value;
    const hideForState = HIDDEN_STATES.has(state);
    const hideForModal = helpModalState.isOpen();
    const hidden = hideForState || hideForModal;
    this.root.classList.toggle("keybindings-help-hint--hidden", hidden);
  }
}
