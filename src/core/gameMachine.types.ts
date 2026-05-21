/**
 * Types stricts pour la state machine du jeu.
 * Source unique de vérité pour les états, events et contexte.
 */

export type GameMode = "solo" | "1v1";

/**
 * Identifiant joueur au format `pseudo#hashtag` (ex: "fouad#1234").
 * Le typage en template literal permet une validation minimale à la compilation,
 * la validation runtime reste à la charge de l'écran d'identification.
 */
export type PlayerTag = `${string}#${string}`;

export interface Player {
  tag: PlayerTag;
  score: number;
  ballsRemaining: number;
}

export type GameStateValue =
  | "splash"
  | "menu"
  | "identification"
  | "playing"
  | "paused"
  | "gameOver"
  | "leaderboard";

export interface GameContext {
  mode: GameMode | null;
  players: Player[];
  currentBall: number;
  startedAt: number | null;
}

export type GameEvent =
  | { type: "PRESS_A" }
  | { type: "START_GAME" }
  | { type: "PLAYERS_VALIDATED"; mode: GameMode; players: PlayerTag[] }
  | { type: "PAUSE" }
  | { type: "RESUME" }
  | { type: "ABANDON" }
  | { type: "GAME_OVER" }
  | { type: "OPEN_LEADERBOARD" }
  | { type: "BACK_TO_MENU" }
  | { type: "REPLAY" };

export type GameEventType = GameEvent["type"];

export interface MachineSnapshot {
  value: GameStateValue;
  context: GameContext;
}
