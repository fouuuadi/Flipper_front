import type { GameMode, PlayerTag } from "@core/gameMachine.types";

const PLAYER_SESSION_KEY = "flipper.playerSession";

export interface PlayerSession {
  readonly mode: GameMode;
  readonly players: PlayerTag[];
}

export function savePlayerSession(mode: GameMode, players: PlayerTag[]): void {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.setItem(PLAYER_SESSION_KEY, JSON.stringify({ mode, players }));
  } catch {
    // Le stockage partagé ne doit jamais bloquer le lancement d'une partie.
  }
}

export function readPlayerSession(): PlayerSession | null {
  if (typeof localStorage === "undefined") return null;
  try {
    const parsed = JSON.parse(localStorage.getItem(PLAYER_SESSION_KEY) ?? "null") as unknown;
    if (!parsed || typeof parsed !== "object") return null;

    const candidate = parsed as { mode?: unknown; players?: unknown };
    if (candidate.mode !== "solo" && candidate.mode !== "1v1") return null;
    if (!Array.isArray(candidate.players) || !candidate.players.every(isPlayerTag)) return null;
    return { mode: candidate.mode, players: candidate.players };
  } catch {
    return null;
  }
}

function isPlayerTag(value: unknown): value is PlayerTag {
  return typeof value === "string" && value.includes("#");
}
