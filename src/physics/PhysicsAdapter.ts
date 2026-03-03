export type BodyId = string;

export interface BodyOptions {
  id?: BodyId;
  x?: number;
  y?: number;
  angle?: number;
  mass?: number;
  isStatic?: boolean;
}

export interface PhysicsAdapter {
  init(): void | Promise<void>;
  addBody(options: BodyOptions): BodyId;
  removeBody(id: BodyId): void;
  step(delta: number): void;
  dispose(): void;
}
