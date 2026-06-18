import type { GameStore } from "./gameStore";
import type { GameMode, PlayerTag } from "./gameMachine.types";
import type { ClientCommand, IntentCommand } from "@services/matchSync";

export function isDevLocalSyncEnabled(): boolean {
  if (!import.meta.env.DEV) return false;
  if (typeof window === "undefined") return false;
  return new URLSearchParams(window.location.search).get("sync") === "local";
}

export function dispatchDevLocalCommand(command: ClientCommand, store: GameStore): boolean {
  if (!isDevLocalSyncEnabled()) return false;

  switch (command.type) {
    case "cmd:pause":
      store.send({ type: "PAUSE" });
      return true;
    case "cmd:resume":
      store.send({ type: "RESUME" });
      return true;
    case "cmd:abandon":
      store.send({ type: "ABANDON" });
      return true;
    case "intent":
      dispatchLocalIntent(command.action, command.payload, store);
      return true;
  }
}

function dispatchLocalIntent(
  action: IntentCommand["action"],
  payload: Record<string, unknown> | undefined,
  store: GameStore,
): void {
  switch (action) {
    case "PRESS_A":
    case "START_GAME":
    case "OPEN_LEADERBOARD":
    case "OPEN_SETTINGS":
    case "BACK_TO_SPLASH":
    case "BACK_TO_MENU":
    case "REPLAY":
      store.send({ type: action });
      return;
    case "OPEN_BOUTIQUE":
      store.send({ type: "OPEN_COSMETICS" });
      return;
    case "PLAYERS_VALIDATED":
      store.send({
        type: "PLAYERS_VALIDATED",
        mode: readMode(payload),
        players: readPlayers(payload),
        sessionId: null,
      });
      return;
  }
}

function readMode(payload: Record<string, unknown> | undefined): GameMode {
  return payload?.mode === "1v1" ? "1v1" : "solo";
}

function readPlayers(payload: Record<string, unknown> | undefined): PlayerTag[] {
  const players = payload?.players;
  if (Array.isArray(players)) {
    return players.filter(isPlayerTag);
  }
  return isPlayerTag(payload?.pseudo) ? [payload.pseudo] : ["DEV#0001"];
}

function isPlayerTag(value: unknown): value is PlayerTag {
  return typeof value === "string" && value.includes("#");
}
