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

// ─────────────────────────────────────────────────────────────
// Server → Client
// ─────────────────────────────────────────────────────────────

export interface MatchStateEvent {
  readonly type: "match:state";
  readonly status: MatchStatus;
  readonly sessionId: string;
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

/** Union discriminée de tous les events émis par le serveur. */
export type WsServerEvent =
  | MatchStateEvent
  | CountdownTickEvent
  | ScoreUpdateEvent
  | BallLostEvent
  | GameOverEvent;

/** Type guard pratique pour les consommateurs. */
export function isServerEvent(payload: unknown): payload is WsServerEvent {
  if (!payload || typeof payload !== "object") return false;
  const type = (payload as { type?: unknown }).type;
  return (
    type === "match:state" ||
    type === "countdown:tick" ||
    type === "score:update" ||
    type === "ball:lost" ||
    type === "game:over"
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

/** Intentions UI envoyées au back pour piloter le `SessionStatus`. */
export type ClientCommand = PauseCommand | ResumeCommand | AbandonCommand;
