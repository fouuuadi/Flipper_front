export type BodyId = string;

// plan (x, z) et verticale y
export type Vec3 = { x: number; y: number; z: number };

export interface BodyOptions {
  id?: BodyId;
  position?: Vec3;
  rotation?: Vec3;
  linearDamping?: number;
  angularDamping?: number;

  x?: number;
  y?: number;
  z?: number;
  angle?: number;

  mass?: number;
  isStatic?: boolean;

  // géométrie et métériau
  shape?: "sphere" | "box";
  radius?: number;
  halfExtents?: Vec3;
  friction?: number;
  restitution?: number;
}

export interface PhysicsAdapter {
  init(): void | Promise<void>;
  addBody(options: BodyOptions): BodyId;
  removeBody(id: BodyId): void;
  step(delta: number): void;
  dispose(): void;
}
