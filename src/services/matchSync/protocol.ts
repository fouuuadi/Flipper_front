/**
 * Contrat WebSocket — protocole MATCH_SYNC.
 *
 * Source de vérité : `Flipper_back/docs/MATCH_SYNC.md`.
 * Doc front miroir : `docs/match-sync-architecture.md`.
 *
 * Ce fichier ne contient que des types — aucune logique runtime.
 * Les payloads matchent exactement ce que le back émet / consomme.
 */

/** Statut courant de la session côté back (`SessionStatus` en Python). */
export type MatchStatus = "waiting" | "ready" | "playing" | "paused" | "over";

/** Valeurs émises par le countdown pré-partie (4 ticks, 1 par seconde). */
export type CountdownValue = 3 | 2 | 1 | 0;

/** Phase de navigation partagée par les 3 écrans (miroir de `BorneNavState` Python). */
export type BorneNav =
  | "splash"
  | "menu"
  | "identification"
  | "boutique"
  | "settings"
  | "leaderboard"
  | "in_game"
  | "game_over";

// ─────────────────────────────────────────────────────────────
// Server → Client
// ─────────────────────────────────────────────────────────────

export interface MatchStateEvent {
  readonly type: "match:state";
  readonly status: MatchStatus;
  readonly sessionId: string;
}

/**
 * État de navigation partagé, broadcasté par la borne. C'est le canal qui
 * synchronise splash/menu/identification/boutique… entre les 3 écrans.
 * `sessionId` est non-null une fois une partie démarrée (`nav: "in_game"`).
 */
export interface NavStateEvent {
  readonly type: "nav:state";
  readonly nav: BorneNav;
  readonly sessionId: string | null;
}

export interface CountdownTickEvent {
  readonly type: "countdown:tick";
  readonly value: CountdownValue;
}

export interface ScoreUpdateEvent {
  readonly type: "score:update";
  readonly score: number;
  readonly combo: number;
  readonly bumperId?: number;
  readonly bonusType?: string;
}

export interface BallLostEvent {
  readonly type: "ball:lost";
  readonly livesRemaining: number;
}

export interface GameOverEvent {
  readonly type: "game:over";
  readonly finalScore: number;
}

/** État complet renvoyé par le backend après création ou reconnexion. */
export interface SessionSnapshotEvent {
  readonly type: "session:snapshot";
  readonly sessionId: string;
  readonly players: readonly string[];
  readonly mode: "solo" | "1v1";
  readonly status: MatchStatus;
  readonly score: number;
  readonly combo: number;
  readonly lives: number;
}

/**
 * Entrées physiques de la borne relayées par le backend (boutons ESP32). En dev
 * elles sont remplacées par le clavier ; le playfield les consomme de la même
 * façon, sans savoir d'où elles viennent.
 */
export interface ControlFlipperEvent {
  readonly type: "control:flipper";
  readonly side: "left" | "right";
  readonly action: "press" | "release";
}

export interface ControlPlungerEvent {
  readonly type: "control:plunger";
  readonly action: "charge" | "release";
}

/** Bouton d'interface de la borne. Le front l'oriente selon l'écran courant. */
export type NavButton = "confirm" | "back" | "left" | "right" | "help";

export interface ControlNavEvent {
  readonly type: "control:nav";
  readonly button: NavButton;
}

/** Union discriminée de tous les events émis par le serveur. */
export type WsServerEvent =
  | NavStateEvent
  | MatchStateEvent
  | CountdownTickEvent
  | ScoreUpdateEvent
  | BallLostEvent
  | GameOverEvent
  | SessionSnapshotEvent
  | ControlFlipperEvent
  | ControlPlungerEvent
  | ControlNavEvent;

/** Type guard pratique pour les consommateurs. */
export function isServerEvent(payload: unknown): payload is WsServerEvent {
  if (!payload || typeof payload !== "object") return false;
  const type = (payload as { type?: unknown }).type;
  return (
    type === "nav:state" ||
    type === "match:state" ||
    type === "countdown:tick" ||
    type === "score:update" ||
    type === "ball:lost" ||
    type === "game:over" ||
    type === "session:snapshot" ||
    type === "control:flipper" ||
    type === "control:plunger" ||
    type === "control:nav"
  );
}

// ─────────────────────────────────────────────────────────────
// Client → Server
// ─────────────────────────────────────────────────────────────

export interface PauseCommand {
  readonly type: "cmd:pause";
}

export interface ResumeCommand {
  readonly type: "cmd:resume";
}

export interface AbandonCommand {
  readonly type: "cmd:abandon";
}

/**
 * Le playfield est l'autorité du jeu (il simule la physique). Il pousse un
 * event serveur déjà calculé (`score:update`, `ball:lost`, `game:over`…) que le
 * backend se contente de rediffuser aux 3 écrans du bus borne.
 */
export interface RelayBorneEventCommand {
  readonly type: "borne:relay";
  readonly event: WsServerEvent;
}

/**
 * Actions de navigation envoyées au backend (qui décide les transitions).
 * Miroir des events du front `gameMachine`, désormais arbitrés côté serveur.
 */
export type NavAction =
  | "PRESS_A"
  | "START_GAME"
  | "OPEN_LEADERBOARD"
  | "OPEN_BOUTIQUE"
  | "OPEN_SETTINGS"
  | "BACK_TO_SPLASH"
  | "BACK_TO_MENU"
  | "PLAYERS_VALIDATED"
  | "REPLAY";

/** Intention de navigation envoyée sur le bus borne. */
export interface IntentCommand {
  readonly type: "intent";
  readonly action: NavAction;
  readonly payload?: Record<string, unknown>;
}

/** Messages client → serveur : intentions de navigation + contrôles de match. */
export type ClientCommand =
  | IntentCommand
  | PauseCommand
  | ResumeCommand
  | AbandonCommand
  | RelayBorneEventCommand;
