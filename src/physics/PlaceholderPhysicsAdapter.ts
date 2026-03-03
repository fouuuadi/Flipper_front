import type { BodyId, BodyOptions, PhysicsAdapter } from "./PhysicsAdapter";

export class PlaceholderPhysicsAdapter implements PhysicsAdapter {
  private nextId = 0;

  init(): void {
    // Aucun moteur physique connecte pour le moment
  }

  addBody(_options: BodyOptions): BodyId {
    this.nextId += 1;
    return `body-${this.nextId}`;
  }

  removeBody(_id: BodyId): void {
    // Pas de simulation reelle
  }

  step(_delta: number): void {
    // Pas de simulation reelle
  }

  dispose(): void {
    this.nextId = 0;
  }
}
