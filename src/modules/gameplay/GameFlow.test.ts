import { describe, expect, it, vi } from "vitest";
import { GameFlow } from "./GameFlow";

function setup(position = { x: 0, y: 5, z: 0 }) {
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
  // Le playfield est l'autorité : il calcule et `publish` (diffusion locale +
  // relais backend). On espionne `publish`.
  const sync = { publish: vi.fn(), emitLocal: vi.fn(), dispatch: vi.fn() };
  const colliders = {
    Bump: { collider: { handle: 2 } },
    Ligne: { collider: { handle: 3 } },
  };
  const onGameOver = vi.fn();

  const flow = new GameFlow(
    physics as never,
    ball as never,
    colliders as never,
    sync as never,
    onGameOver,
  );
  flow.setActive(true); // scoring/drain n'agissent qu'en partie
  return { flow, collision: () => collision, sync, ball, onGameOver };
}

describe("GameFlow (playfield autoritaire)", () => {
  it("compte les points et le combo quand la bille touche un bumper", () => {
    const { collision, sync } = setup();

    collision()?.(1, 2, true);

    expect(sync.publish).toHaveBeenCalledWith({
      type: "score:update",
      score: 750,
      combo: 1,
      bonusType: "BUMP",
    });
  });

  it("ne marque aucun point hors partie (boot / menus)", () => {
    const { flow, collision, sync } = setup();
    flow.setActive(false);

    collision()?.(1, 2, true);

    expect(sync.publish).not.toHaveBeenCalled();
  });

  it("attribue des points à la cible Ligne (scoring auparavant manquant)", () => {
    const { collision, sync } = setup();

    collision()?.(1, 3, true);

    expect(sync.publish).toHaveBeenCalledWith({
      type: "score:update",
      score: 300,
      combo: 1,
      bonusType: "LIGNE",
    });
  });

  it("décrémente les vies puis replace la bille à la perte", () => {
    vi.useFakeTimers();
    const { flow, sync, ball } = setup({ x: 0, y: 1, z: 0 });

    flow.update(0.016);

    expect(sync.publish).toHaveBeenCalledWith({ type: "ball:lost", livesRemaining: 2 });
    vi.advanceTimersByTime(700);
    expect(ball.reset).toHaveBeenCalledOnce();
    vi.useRealTimers();
  });

  it("déclenche le game over après épuisement des vies", () => {
    vi.useFakeTimers();
    const { flow, sync, onGameOver } = setup({ x: 0, y: 1, z: 0 });

    flow.update(0.016); // 3 → 2
    vi.advanceTimersByTime(700);
    flow.update(0.016); // 2 → 1
    vi.advanceTimersByTime(700);
    flow.update(0.016); // 1 → 0 → game over

    expect(sync.publish).toHaveBeenCalledWith({ type: "game:over", finalScore: 0 });
    expect(onGameOver).toHaveBeenCalledOnce();
    vi.useRealTimers();
  });
});
