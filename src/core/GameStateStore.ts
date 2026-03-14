import { GameState } from "./GameState";

type Listener = (state: GameState) => void;

class GameStateStore {
  private state: GameState = GameState.INIT;
  private listeners: Set<Listener> = new Set();

  getState(): GameState {
    return this.state;
  }

  setState(newState: GameState): void {
    if (this.state === newState) return;

    this.state = newState;
    this.emit();
  }

  subscribe(listener: Listener): void {
    this.listeners.add(listener);
  }

  unsubscribe(listener: Listener): void {
    this.listeners.delete(listener);
  }

  private emit(): void {
    this.listeners.forEach((listener) => listener(this.state));
  }
}

export const gameStateStore = new GameStateStore();
