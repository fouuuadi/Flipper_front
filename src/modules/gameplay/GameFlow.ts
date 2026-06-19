import type { Ball } from "@modules/ball";
import type { NamedPhysicsCollider } from "@modules/table/BlenderPhysicsColliders";
import type { RapierPhysicsAdapter } from "@physics/RapierPhysicsAdapter";
import type { MatchSyncAdapter } from "@services/matchSync";

type ColliderMap = Record<string, NamedPhysicsCollider>;

const SCORE_BY_COLLIDER: Record<string, { points: number; label: string }> = {
  Slingshot_triangle: { points: 150, label: "SLINGSHOT" },
  Planet_Glace: { points: 500, label: "PLANET" },
  Planet_Terre: { points: 500, label: "PLANET" },
  Planet_Volcan: { points: 500, label: "PLANET" },
  Bump: { points: 750, label: "BUMP" },
  Champignion_a: { points: 350, label: "SPINNER" },
  Champignion_b: { points: 350, label: "SPINNER" },
  Rampe: { points: 250, label: "RAMP" },
  Ramp_2: { points: 250, label: "RAMP" },
};

export class GameFlow {
  private readonly handleToName = new Map<number, string>();
  private readonly scoredCooldowns = new Map<string, number>();

  private elapsed = 0;
  private score = 0;
  private combo = 0;
  private lives = 3;
  private isDraining = false;
  private isGameOver = false;

  constructor(
    private readonly physics: RapierPhysicsAdapter,
    private readonly ball: Ball,
    colliders: ColliderMap,
    private readonly sync: MatchSyncAdapter,
    private readonly onGameOver?: () => void,
  ) {
    for (const [name, entry] of Object.entries(colliders)) {
      if (SCORE_BY_COLLIDER[name]) this.handleToName.set(entry.collider.handle, name);
    }

    this.physics.onCollision((handle1, handle2, started) => {
      this.handleCollision(handle1, handle2, started);
    });

    this.sync.emitLocal({ type: "score:update", score: this.score, combo: this.combo });
    this.sync.emitLocal({ type: "ball:lost", livesRemaining: this.lives });
  }

  update(deltaTime: number): void {
    if (this.isGameOver) return;

    this.elapsed += deltaTime;
    this.detectDrain();
  }

  private handleCollision(handle1: number, handle2: number, started: boolean): void {
    if (!started || this.isGameOver) return;

    const ballCollider = this.ball.getCollider();
    if (!ballCollider) return;

    const ballHandle = ballCollider.handle;
    let name: string | undefined;
    if (handle1 === ballHandle) name = this.handleToName.get(handle2);
    if (handle2 === ballHandle) name = this.handleToName.get(handle1);
    if (!name || this.isCoolingDown(name)) return;

    const rule = SCORE_BY_COLLIDER[name];
    this.combo = Math.min(this.combo + 1, 9);
    this.score += rule.points * this.combo;

    this.sync.emitLocal({
      type: "score:update",
      score: this.score,
      combo: this.combo,
      bonusType: rule.label,
    });
  }

  private isCoolingDown(name: string): boolean {
    const lastTime = this.scoredCooldowns.get(name) ?? -Infinity;
    if (this.elapsed - lastTime < 0.18) return true;

    this.scoredCooldowns.set(name, this.elapsed);
    return false;
  }

  private detectDrain(): void {
    const body = this.ball.getBody();
    if (!body || this.isDraining) return;

    const position = body.translation();
    const isInDrainLane = position.z < -12.25 && position.x > -5.4;
    const isOutOfTable = Math.abs(position.x) > 10 || position.z < -16 || position.z > 15;
    const isFallen = position.y < 2.5;

    if (!isInDrainLane && !isOutOfTable && !isFallen) return;

    this.isDraining = true;
    this.combo = 0;
    this.lives = Math.max(0, this.lives - 1);
    this.sync.emitLocal({ type: "ball:lost", livesRemaining: this.lives });

    if (this.lives <= 0) {
      this.isGameOver = true;
      this.sync.emitLocal({ type: "game:over", finalScore: this.score });
      this.sync.emitLocal({ type: "match:state", status: "over", sessionId: "local-dev" });
      this.onGameOver?.();
      return;
    }

    window.setTimeout(() => {
      this.ball.reset();
      this.isDraining = false;
    }, 700);
  }
}
