/**
 * Store réactif pour la state machine du jeu.
 * Encapsule la snapshot courante et notifie les abonnés à chaque transition.
 *
 * Les écrans consomment ce store en lecture seule via `subscribe` / `getState`,
 * et déclenchent des transitions via `send` en passant un event typé.
 */

import { initialContext, initialState, transition } from "./gameMachine";
import type { GameEvent, MachineSnapshot } from "./gameMachine.types";

export type GameStoreListener = (snapshot: MachineSnapshot) => void;

export interface GameStore {
  getState(): MachineSnapshot;
  send(event: GameEvent): void;
  subscribe(listener: GameStoreListener): () => void;
}

/**
 * Factory exportée pour permettre la création d'instances isolées en test.
 */
export function createGameStore(): GameStore {
  let snapshot: MachineSnapshot = {
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
    listeners.forEach((l) => l(snapshot));
  }

  function subscribe(listener: GameStoreListener): () => void {
    listeners.add(listener);
    listener(snapshot);
    return () => {
      listeners.delete(listener);
    };
  }

  return { getState, send, subscribe };
}

/** Instance singleton consommée par l'app playfield. */
export const gameStore = createGameStore();
