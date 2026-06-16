import { describe, expect, it, vi } from "vitest";

import { createGameStore } from "@core/gameStore";
import { bindGameplayInput, type GameplayControls } from "./bindGameplayInput";

function makeControls() {
  return {
    leftFlipper: { press: vi.fn(), release: vi.fn() },
    rightFlipper: { press: vi.fn(), release: vi.fn() },
    launcher: { startCharge: vi.fn(), release: vi.fn() },
  };
}

function keyEvent(type: "keydown" | "keyup", code: string): Event {
  const event = new Event(type);
  (event as { code?: string }).code = code;
  return event;
}

function driveToPlaying(store: ReturnType<typeof createGameStore>): void {
  store.send({ type: "PRESS_A" });
  store.send({ type: "START_GAME" });
  store.send({ type: "PLAYERS_VALIDATED", mode: "solo", players: ["DEV#0001"], sessionId: null });
}

describe("bindGameplayInput", () => {
  it("ignore le keydown gameplay hors de l'état playing", () => {
    const store = createGameStore(); // splash
    const controls = makeControls();
    const target = new EventTarget();
    bindGameplayInput(store, controls as unknown as GameplayControls, target);

    target.dispatchEvent(keyEvent("keydown", "ShiftLeft"));
    target.dispatchEvent(keyEvent("keydown", "Space"));

    expect(controls.leftFlipper.press).not.toHaveBeenCalled();
    expect(controls.launcher.startCharge).not.toHaveBeenCalled();
  });

  it("route les touches gameplay vers les contrôles en état playing", () => {
    const store = createGameStore();
    const controls = makeControls();
    const target = new EventTarget();
    bindGameplayInput(store, controls as unknown as GameplayControls, target);
    driveToPlaying(store);

    target.dispatchEvent(keyEvent("keydown", "ShiftLeft"));
    target.dispatchEvent(keyEvent("keydown", "ShiftRight"));
    target.dispatchEvent(keyEvent("keydown", "Space"));

    expect(controls.leftFlipper.press).toHaveBeenCalledTimes(1);
    expect(controls.rightFlipper.press).toHaveBeenCalledTimes(1);
    expect(controls.launcher.startCharge).toHaveBeenCalledTimes(1);
  });

  it("relâche même hors playing (pas de flipper collé après une transition)", () => {
    const store = createGameStore();
    const controls = makeControls();
    const target = new EventTarget();
    bindGameplayInput(store, controls as unknown as GameplayControls, target);
    // état splash : keyup doit quand même relâcher
    target.dispatchEvent(keyEvent("keyup", "ShiftLeft"));
    target.dispatchEvent(keyEvent("keyup", "Space"));

    expect(controls.leftFlipper.release).toHaveBeenCalledTimes(1);
    expect(controls.launcher.release).toHaveBeenCalledTimes(1);
  });

  it("le cleanup retire les listeners", () => {
    const store = createGameStore();
    const controls = makeControls();
    const target = new EventTarget();
    const dispose = bindGameplayInput(store, controls as unknown as GameplayControls, target);
    driveToPlaying(store);

    dispose();
    target.dispatchEvent(keyEvent("keydown", "ShiftLeft"));

    expect(controls.leftFlipper.press).not.toHaveBeenCalled();
  });
});
