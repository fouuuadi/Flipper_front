import { describe, expect, it, vi } from "vitest";
import { GameFlow } from "./GameFlow";

function setupConnectedFlow(position = { x: 0, y: 5, z: 0 }) {
  let collision: ((a: number, b: number, started: boolean) => void) | undefined;
  const physics = {
    onCollision: vi.fn((handler) => {
      collision = handler;
    }),
  };
  const ball = {
    getCollider: vi.fn(() => ({ handle: 1 })),
    getBody: vi.fn(() => ({ translation: () => position })),
    reset: vi.fn(),
  };
  const sync = { dispatch: vi.fn(), emitLocal: vi.fn() };
  const colliders = { Bump: { collider: { handle: 2 } } };

  const flow = new GameFlow(
    physics as never,
    ball as never,
    colliders as never,
    sync as never,
    undefined,
    false,
  );
  return { flow, collision: () => collision, sync, ball };
}

describe("GameFlow connecté", () => {
  it("envoie un target_hit brut sans calculer le score localement", () => {
    const { collision, sync } = setupConnectedFlow();
    collision()?.(1, 2, true);

    expect(sync.emitLocal).not.toHaveBeenCalled();
    expect(sync.dispatch).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "game:event",
        event: "target_hit",
        targetId: "Bump",
      }),
    );
  });

  it("envoie ball_lost puis replace la bille virtuelle", () => {
    vi.useFakeTimers();
    const { flow, sync, ball } = setupConnectedFlow({ x: 0, y: 1, z: 0 });
    flow.update(0.016);

    expect(sync.dispatch).toHaveBeenCalledWith(
      expect.objectContaining({ type: "game:event", event: "ball_lost" }),
    );
    vi.advanceTimersByTime(700);
    expect(ball.reset).toHaveBeenCalledOnce();
    vi.useRealTimers();
  });
});
