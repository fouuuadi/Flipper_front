/**
 * Store réactif pour la state machine du jeu.
 * Encapsule la snapshot courante et notifie les abonnés à chaque transition.
 *
 * Les écrans consomment ce store en lecture seule via `subscribe` / `getState`,
 * et déclenchent des transitions via `send` en passant un event typé.
 */

import { initialContext, initialState, transition } from "./gameMachine";
import type { GameContext, GameEvent, GameStateValue, MachineSnapshot } from "./gameMachine.types";

const SNAPSHOT_STORAGE_KEY = "flipper.gameSnapshot";

export type GameStoreListener = (snapshot: MachineSnapshot) => void;

export interface GameStore {
  getState(): MachineSnapshot;
  send(event: GameEvent): void;
  /**
   * Applique directement un état imposé par le backend (mode « follower »),
   * sans passer par `transition()`. Le contexte est **fusionné** (patch
   * partiel) pour préserver les infos locales déjà connues (ex: joueurs saisis
   * à l'identification) tout en laissant le backend piloter la valeur d'état.
   */
  applyServerState(value: GameStateValue, contextPatch?: Partial<GameContext>): void;
  subscribe(listener: GameStoreListener): () => void;
}

/**
 * Factory exportée pour permettre la création d'instances isolées en test.
 */
export function createGameStore(): GameStore {
  let snapshot: MachineSnapshot = readPersistedSnapshot() ?? {
    value: initialState,
    context: { ...initialContext },
  };
  const listeners = new Set<GameStoreListener>();

  function getState(): MachineSnapshot {
    return snapshot;
  }

  function send(event: GameEvent): void {
    const next = transition(snapshot, event);
    if (!next) {
      if (import.meta.env.DEV) {
        console.warn(
          `[gameStore] Event "${event.type}" ignored — not allowed in state "${snapshot.value}"`,
        );
      }
      return;
    }
    snapshot = next;
    persistSnapshot(snapshot);
    listeners.forEach((l) => l(snapshot));
  }

  function applyServerState(value: GameStateValue, contextPatch?: Partial<GameContext>): void {
    snapshot = {
      value,
      context: contextPatch ? { ...snapshot.context, ...contextPatch } : snapshot.context,
    };
    persistSnapshot(snapshot);
    listeners.forEach((l) => l(snapshot));
  }

  function subscribe(listener: GameStoreListener): () => void {
    listeners.add(listener);
    listener(snapshot);
    return () => {
      listeners.delete(listener);
    };
  }

  return { getState, send, applyServerState, subscribe };
}

function readPersistedSnapshot(): MachineSnapshot | null {
  if (typeof sessionStorage === "undefined") return null;
  const raw = sessionStorage.getItem(SNAPSHOT_STORAGE_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as MachineSnapshot;
    if (!parsed || typeof parsed.value !== "string" || !parsed.context) return null;
    return parsed;
  } catch {
    return null;
  }
}

function persistSnapshot(snapshot: MachineSnapshot): void {
  if (typeof sessionStorage === "undefined") return;
  sessionStorage.setItem(SNAPSHOT_STORAGE_KEY, JSON.stringify(snapshot));
}

/** Instance singleton consommée par l'app playfield. */
export const gameStore = createGameStore();
