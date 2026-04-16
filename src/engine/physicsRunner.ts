import type { PhysicsAdapter } from "@physics/PhysicsAdapter";

export interface PhysicsSyncTarget {
  capturePreviousState(): void;
  syncFromPhysics(): void;
}

export class PhysicsRunner {
  private readonly syncTargets = new Set<PhysicsSyncTarget>();

  constructor(private readonly physics: PhysicsAdapter) {}

  registerSyncTarget(target: PhysicsSyncTarget): () => void {
    this.syncTargets.add(target);
    return () => this.syncTargets.delete(target);
  }

  step(fixedDelta: number): void {
    this.syncTargets.forEach((target) => target.capturePreviousState());

    this.physics.step(fixedDelta);

    this.syncTargets.forEach((target) => target.syncFromPhysics());
  }

  syncNow(): void {
    this.syncTargets.forEach((target) => {
      target.syncFromPhysics();
      target.capturePreviousState();
    });
  }
}
