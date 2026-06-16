import type { GameEvent, GameStateValue } from "@core/gameMachine.types";

/**
 * Special wildcard key matching ANY KeyboardEvent.key value.
 * Utilisé par le splash où "n'importe quelle touche" déclenche `PRESS_A`.
 */
export const ANY_KEY = "*" as const;

/**
 * Sous-ensemble des events SM dispatchables sans payload depuis un binding
 * clavier. Exclut `PLAYERS_VALIDATED` qui nécessite mode / players / sessionId
 * et n'a aucun sens depuis une touche unique — l'écran identification le
 * dispatche lui-même après validation du formulaire.
 */
export type SimpleGameEvent = Exclude<GameEvent, { type: "PLAYERS_VALIDATED" }>;
export type SimpleGameEventType = SimpleGameEvent["type"];

export interface KeyBinding {
  /** État SM dans lequel ce binding est actif. */
  readonly state: GameStateValue;
  /** `KeyboardEvent.key` à matcher, ou {@link ANY_KEY} pour matcher tout. */
  readonly key: string;
  /**
   * Event SM à dispatcher. Pour `PAUSE` / `RESUME` / `ABANDON`, le dispatcher
   * route via `dispatchIntent` qui choisit `cmd:*` ou SM direct selon la
   * présence d'une session back.
   */
  readonly event: SimpleGameEventType;
  /** Libellé affiché dans la modal d'aide. */
  readonly label: string;
}

/**
 * Source de vérité unique des raccourcis clavier de l'app playfield.
 *
 * Consommée par :
 *   - `KeyboardDispatcher` pour router une touche vers l'event SM correspondant
 *   - `KeybindingsHelp` pour afficher la liste filtrée par état courant
 *
 * Les raccourcis purement gameplay (Q/D pour les flippers, saisie clavier
 * dans un `<Input />`) restent gérés localement par leur module — ils ne
 * passent pas par cette table.
 */
export const BINDINGS: readonly KeyBinding[] = [
  // splash — "press any key to start"
  { state: "splash", key: ANY_KEY, event: "PRESS_A", label: "Commencer" },

  // menu
  { state: "menu", key: "Enter", event: "START_GAME", label: "Démarrer une partie" },
  { state: "menu", key: "l", event: "OPEN_LEADERBOARD", label: "Ouvrir le leaderboard" },
  { state: "menu", key: "b", event: "OPEN_COSMETICS", label: "Ouvrir la boutique" },
  { state: "menu", key: "p", event: "OPEN_SETTINGS", label: "Ouvrir les parametres" },

  // identification — pas de binding global ; l'Input.ts gère sa saisie

  // playing
  { state: "playing", key: "Escape", event: "PAUSE", label: "Mettre en pause" },

  // paused
  { state: "paused", key: "Escape", event: "RESUME", label: "Reprendre la partie" },
  { state: "paused", key: "a", event: "ABANDON", label: "Abandonner (fin immédiate)" },

  // gameOver
  { state: "gameOver", key: "r", event: "REPLAY", label: "Rejouer (mêmes joueurs)" },
  { state: "gameOver", key: "m", event: "BACK_TO_MENU", label: "Retour au menu" },

  // leaderboard
  { state: "leaderboard", key: "Escape", event: "BACK_TO_MENU", label: "Retour au menu" },
  { state: "cosmetics", key: "Escape", event: "BACK_TO_MENU", label: "Retour au menu" },
  { state: "settings", key: "Escape", event: "BACK_TO_MENU", label: "Retour au menu" },
];

/**
 * Retourne les bindings actifs pour l'état SM donné.
 * Les bindings wildcard ({@link ANY_KEY}) sont inclus tels quels — c'est au
 * dispatcher d'interpréter le match.
 */
export function bindingsForState(state: GameStateValue): readonly KeyBinding[] {
  return BINDINGS.filter((b) => b.state === state);
}

/**
 * Cherche le binding qui matche une touche pour un état donné.
 * Priorité : match exact > wildcard. Retourne `null` si aucun binding.
 *
 * @param state état SM courant
 * @param key   `KeyboardEvent.key` reçu (case-sensitive — les bindings sont
 *              déclarés en minuscule pour les lettres, le dispatcher
 *              normalise avant l'appel)
 */
export function findBinding(state: GameStateValue, key: string): KeyBinding | null {
  const candidates = bindingsForState(state);
  return candidates.find((b) => b.key === key) ?? candidates.find((b) => b.key === ANY_KEY) ?? null;
}
