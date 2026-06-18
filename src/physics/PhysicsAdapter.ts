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
  // "trimesh" : collider statique construit directement depuis la géométrie
  // d'un mesh réel (ex. le "Plane" Blender) — voir vertices/indices ci-dessous.
  shape?: "sphere" | "box" | "trimesh";
  radius?: number;
  halfExtents?: Vec3;
  friction?: number;
  restitution?: number;

  // Pour shape "trimesh" : sommets/indices déjà exprimés dans le repère monde
  // (matrice du mesh baked dedans), donc position/rotation du body restent
  // à {0,0,0} / identité pour ce shape.
  vertices?: Float32Array;
  indices?: Uint32Array;
}

export interface PhysicsAdapter {
  init(): void | Promise<void>;
  addBody(options: BodyOptions): BodyId;
  removeBody(id: BodyId): void;
  step(delta: number): void;
  dispose(): void;
}
