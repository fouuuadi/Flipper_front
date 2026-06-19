import * as THREE from "three";
import type RAPIER from "@dimforge/rapier3d-compat";
import type { BodyId, Vec3 } from "@physics/PhysicsAdapter";
import type { RapierPhysicsAdapter } from "@physics/RapierPhysicsAdapter";

export interface BallOptions {
  id?: BodyId;
  radius?: number;
  mass?: number;
  friction?: number;
  restitution?: number;
  linearDamping?: number;
  angularDamping?: number;
  maxLinearSpeed?: number;
  initialPosition?: Vec3;
}

export class Ball {
  readonly mesh: THREE.Mesh;

  private readonly physics: RapierPhysicsAdapter;
  private readonly bodyId: BodyId;
  private readonly initialPosition: Vec3;
  private readonly maxLinearSpeed: number;

  constructor(physics: RapierPhysicsAdapter, options: BallOptions = {}) {
    const radius = options.radius ?? 0.12;

    this.physics = physics;
    this.initialPosition = options.initialPosition ?? { x: 0, y: 1.5, z: 3 };
    this.maxLinearSpeed = options.maxLinearSpeed ?? 10;

    const geometry = new THREE.SphereGeometry(radius, 32, 32);
    const material = new THREE.MeshStandardMaterial({
      color: 0xd9d9d9,
      metalness: 0.95,
      roughness: 0.2,
    });

    this.mesh = new THREE.Mesh(geometry, material);
    this.mesh.castShadow = true;
    this.mesh.receiveShadow = true;

    this.bodyId = this.physics.addBody({
      id: options.id,
      position: this.initialPosition,
      shape: "sphere",
      radius,
      mass: options.mass ?? 0.08,
      isStatic: false,
      friction: options.friction ?? 0.12,
      restitution: options.restitution ?? 0.55,
      linearDamping: options.linearDamping ?? 0.02,
      angularDamping: options.angularDamping ?? 0.015,
    });

    this.updateFromPhysics();
  }

  addTo(scene: THREE.Scene): void {
    scene.add(this.mesh);
  }

  removeFrom(scene: THREE.Scene): void {
    scene.remove(this.mesh);
  }

  updateFromPhysics(): void {
    const body = this.physics.getBody(this.bodyId);
    if (!body) return;

    this.clampLinearVelocity(body);

    const position = body.translation();
    const rotation = body.rotation();

    this.mesh.position.set(position.x, position.y, position.z);
    this.mesh.quaternion.set(rotation.x, rotation.y, rotation.z, rotation.w);
  }

  private clampLinearVelocity(body: RAPIER.RigidBody): void {
    const velocity = body.linvel();
    const speed = Math.sqrt(velocity.x ** 2 + velocity.y ** 2 + velocity.z ** 2);
    if (speed <= this.maxLinearSpeed) return;

    const scale = this.maxLinearSpeed / speed;
    body.setLinvel(
      {
        x: velocity.x * scale,
        y: velocity.y * scale,
        z: velocity.z * scale,
      },
      true,
    );
  }

  /** Applique une impulsion (ex. propulsion par le lanceur, kick du slingshot) sur le corps. */
  applyImpulse(impulse: Vec3): void {
    const body = this.physics.getBody(this.bodyId);
    if (!body) return;

    body.applyImpulse(impulse, true);
  }

  /** Accès direct au rigid-body Rapier (ex. lecture de la vitesse pour le slingshot). */
  getBody(): RAPIER.RigidBody | null {
    return this.physics.getBody(this.bodyId);
  }

  /** Accès direct au collider Rapier (ex. identification dans les événements de collision). */
  getCollider(): RAPIER.Collider | null {
    return this.physics.getCollider(this.bodyId);
  }

  reset(): void {
    const body = this.physics.getBody(this.bodyId);
    if (!body) return;

    body.setTranslation(this.initialPosition, true);
    body.setLinvel({ x: 0, y: 0, z: 0 }, true);
    body.setAngvel({ x: 0, y: 0, z: 0 }, true);

    this.updateFromPhysics();
  }

  dispose(): void {
    this.physics.removeBody(this.bodyId);
    this.mesh.geometry.dispose();
    (this.mesh.material as THREE.Material).dispose();
  }
}
