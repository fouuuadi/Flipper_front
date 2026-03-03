export type BodyId = string

export type BodyOptions = {
  id?: BodyId
  x?: number
  y?: number
  angle?: number
  mass?: number
}

export interface PhysicsAdapter {
  init(): void | Promise<void>
  addBody(options: BodyOptions): BodyId
  step(deltaMs: number): void
}
