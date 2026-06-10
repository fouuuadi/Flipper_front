import type { GameStore } from "@core/gameStore";
import type { MatchSyncAdapter } from "@services/matchSync";

import { findBinding, type SimpleGameEvent } from "./bindings";
import { dispatchIntent } from "./dispatchIntent";
import { helpModalState } from "./helpModalState";

/**
 * Touches réservées : la modal d'aide les écoute, le dispatcher ne doit
 * jamais les router (sinon `?` au splash déclencherait `PRESS_A` via le
 * wildcard avant que la modal puisse s'ouvrir).
 */
const RESERVED_KEYS = new Set<string>(["?"]);

export interface KeyboardDispatcherOptions {
  readonly store: GameStore;
  readonly sync: MatchSyncAdapter;
  /**
   * Cible des `keydown` (défaut `window`). Injectable pour les tests
   * unitaires (peut être un `EventTarget` léger).
   */
  readonly target?: EventTarget;
  /**
   * Override l'état "modal d'aide ouverte". Par défaut consulte le
   * singleton `helpModalState`. Injectable pour les tests qui veulent
   * isoler le dispatcher de l'état partagé.
   */
  readonly isHelpOpen?: () => boolean;
}

/**
 * Listener `keydown` global qui route les touches vers les events SM
 * définis dans `bindings.ts`. Une seule instance attendue par app, montée
 * au boot dans `src/main.ts`.
 *
 * Conventions :
 *   - Les lettres sont normalisées en minuscule avant lookup (les bindings
 *     sont déclarés en minuscule). Les touches nommées (`Escape`, `Enter`,
 *     ` `, `Tab`…) sont passées telles quelles.
 *   - Les `keydown` qui ciblent un `<input>` / `<textarea>` / `contenteditable`
 *     sont ignorés — l'utilisateur saisit du texte, ce n'est pas une
 *     intention de jeu.
 *   - Quand la modal d'aide est ouverte, le dispatcher ne fait rien : la
 *     modal absorbe son propre Escape / `?`.
 *   - Sur match, `event.preventDefault()` est appelé pour éviter le scroll
 *     espace en `playing` ou le tab focus en `splash`.
 */
export class KeyboardDispatcher {
  private readonly target: EventTarget;
  private readonly handler: (event: Event) => void;
  private readonly isHelpOpen: () => boolean;
  private started = false;

  constructor(private readonly options: KeyboardDispatcherOptions) {
    this.target = options.target ?? window;
    this.isHelpOpen = options.isHelpOpen ?? (() => helpModalState.isOpen());
    this.handler = (event) => this.onKeydown(event as KeyboardEvent);
  }

  start(): void {
    if (this.started) return;
    this.target.addEventListener("keydown", this.handler);
    this.started = true;
  }

  stop(): void {
    if (!this.started) return;
    this.target.removeEventListener("keydown", this.handler);
    this.started = false;
  }

  private onKeydown(event: KeyboardEvent): void {
    if (this.isHelpOpen()) return;
    if (RESERVED_KEYS.has(event.key)) return;
    if (isEditableTarget(event.target)) return;

    const state = this.options.store.getState().value;
    const key = normalizeKey(event.key);
    const binding = findBinding(state, key);
    if (!binding) return;

    event.preventDefault();
    // Safe : `binding.event` est typé `SimpleGameEventType` (sans PLAYERS_VALIDATED).
    // Le cast est nécessaire car TypeScript ne peut pas inférer la branche
    // exacte de l'union depuis une variable de type union de literals.
    const smEvent = { type: binding.event } as SimpleGameEvent;
    dispatchIntent(smEvent, this.options);
  }
}

function normalizeKey(key: string): string {
  // Une touche caractère unique (ex: "A", "z", "?") → lowercase pour matcher
  // les bindings déclarés en minuscule. Les touches nommées (`Escape`,
  // `Enter`, ` `, `ArrowLeft`…) restent telles quelles.
  return key.length === 1 ? key.toLowerCase() : key;
}

function isEditableTarget(target: EventTarget | null): boolean {
  if (!target) return false;
  // Duck typing pour rester compatible avec un environnement de test sans
  // DOM (vitest tourne en `node` ici — pas de `HTMLElement` global).
  const tag = (target as { tagName?: unknown }).tagName;
  if (typeof tag === "string") {
    if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return true;
  }
  const editable = (target as { isContentEditable?: unknown }).isContentEditable;
  return editable === true;
}
