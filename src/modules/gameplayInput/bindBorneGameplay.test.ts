import { describe, expect, it, vi } from "vitest";

import { createGameStore } from "@core/gameStore";
import { bindBorneGameplay } from "./bindBorneGameplay";
import type { GameplayControls } from "./bindGameplayInput";
import type { MatchSyncAdapter } from "@services/matchSync";
import type { WsServerEvent } from "@services/matchSync";

function makeControls() {
  return {
    leftFlipper: { press: vi.fn(), release: vi.fn() },
    rightFlipper: { press: vi.fn(), release: vi.fn() },
    launcher: { startCharge: vi.fn(), release: vi.fn() },
  };
}

/** Faux bus borne : capture le handler et permet de pousser des events. */
function makeSync() {
  let handler: ((event: WsServerEvent) => void) | null = null;
  const sync: Pick<MatchSyncAdapter, "onEvent"> = {
    onEvent: (h) => {
      handler = h;
      return () => {
        handler = null;
      };
    },
  };
  return { sync, emit: (event: WsServerEvent) => handler?.(event) };
}

function driveToPlaying(store: ReturnType<typeof createGameStore>): void {
  store.send({ type: "PRESS_A" });
  store.send({ type: "START_GAME" });
  store.send({ type: "PLAYERS_VALIDATED", mode: "solo", players: ["DEV#0001"], sessionId: null });
}

describe("bindBorneGameplay", () => {
  it("ignore l'appui flipper hors de l'état playing", () => {
    const store = createGameStore(); // splash
    const controls = makeControls();
    const { sync, emit } = makeSync();
    bindBorneGameplay(store, controls as unknown as GameplayControls, sync);

    emit({ type: "control:flipper", side: "left", action: "press" });
    emit({ type: "control:plunger", action: "charge" });

    expect(controls.leftFlipper.press).not.toHaveBeenCalled();
    expect(controls.launcher.startCharge).not.toHaveBeenCalled();
  });

  it("route les events flippers/plunger vers les contrôles en playing", () => {
    const store = createGameStore();
    const controls = makeControls();
    const { sync, emit } = makeSync();
    bindBorneGameplay(store, controls as unknown as GameplayControls, sync);
    driveToPlaying(store);

    emit({ type: "control:flipper", side: "left", action: "press" });
    emit({ type: "control:flipper", side: "right", action: "press" });
    emit({ type: "control:plunger", action: "charge" });

    expect(controls.leftFlipper.press).toHaveBeenCalledTimes(1);
    expect(controls.rightFlipper.press).toHaveBeenCalledTimes(1);
    expect(controls.launcher.startCharge).toHaveBeenCalledTimes(1);
  });

  it("relâche même hors playing (pas de flipper collé après une transition)", () => {
    const store = createGameStore(); // splash
    const controls = makeControls();
    const { sync, emit } = makeSync();
    bindBorneGameplay(store, controls as unknown as GameplayControls, sync);

    emit({ type: "control:flipper", side: "left", action: "release" });
    emit({ type: "control:plunger", action: "release" });

    expect(controls.leftFlipper.release).toHaveBeenCalledTimes(1);
    expect(controls.launcher.release).toHaveBeenCalledTimes(1);
  });

  it("le cleanup se désabonne du bus", () => {
    const store = createGameStore();
    const controls = makeControls();
    const { sync, emit } = makeSync();
    const dispose = bindBorneGameplay(store, controls as unknown as GameplayControls, sync);
    driveToPlaying(store);

    dispose();
    emit({ type: "control:flipper", side: "left", action: "press" });

    expect(controls.leftFlipper.press).not.toHaveBeenCalled();
  });
});
