import type { BodyId, BodyOptions, PhysicsAdapter } from './PhysicsAdapter'

export class PlaceholderPhysicsAdapter implements PhysicsAdapter {
  private idCount = 0

  init(): void {
    // Pour l'instant aucun moteur physique n'est branché
  }

  addBody(_options: BodyOptions): BodyId {
    this.idCount += 1
    return `body-${this.idCount}`
  }

  step(_deltaMs: number): void {
    // Pas de simulation réelle pour le moment
  }
}
