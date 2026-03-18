import * as THREE from "three";
import type { BodyId, Vec3 } from "@physics/PhysicsAdapter";
import type { RapierPhysicsAdapter } from "@physics/RapierPhysicsAdapter";

export interface BallOptions {
  id?: BodyId;
  radius?: number;
  mass?: number;
  friction?: number;
  restitution?: number;
  initialPosition?: Vec3;
}

export class Ball {
  readonly mesh: THREE.Mesh;

  private readonly physics: RapierPhysicsAdapter;
  private readonly bodyId: BodyId;
  private readonly initialPosition: Vec3;

  constructor(physics: RapierPhysicsAdapter, options: BallOptions = {}) {
    const radius = options.radius ?? 0.12;

    this.physics = physics;
    this.initialPosition = options.initialPosition ?? { x: 0, y: 1.5, z: 3 };

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
      linearDamping: 0.08,
      angularDamping: 0.08,
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

    const position = body.translation();
    const rotation = body.rotation();

    this.mesh.position.set(position.x, position.y, position.z);
    this.mesh.quaternion.set(rotation.x, rotation.y, rotation.z, rotation.w);
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
