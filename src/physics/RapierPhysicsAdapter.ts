import * as RAPIER from "@dimforge/rapier3d-compat";
import type { BodyId, BodyOptions, PhysicsAdapter } from "./PhysicsAdapter";
import { Quaternion as ThreeQuaternion, Euler } from "three";

type BodyHandle = {
  body: RAPIER.RigidBody;
  collider?: RAPIER.Collider;
};

export class RapierPhysicsAdapter implements PhysicsAdapter {
  private nextId = 0;

  private world: RAPIER.World | null = null;
  private handles = new Map<BodyId, BodyHandle>();

  async init(): Promise<void> {
    if (this.world) return;

    await RAPIER.init();

    // force gravitationnelle vectorielle sur l'axe y
    this.world = new RAPIER.World({ x: 0, y: -9.81, z: 0 });
  }

  addBody(options: BodyOptions): BodyId {
    const world = this.getWorld();

    const id = options.id ?? this.newId();

    const position = options.position ?? {
      x: options.x ?? 0,
      y: options.y ?? 0,
      z: options.z ?? 0,
    };

    const rotation = options.rotation ?? {
      x: 0,
      y: options.angle ?? 0,
      z: 0,
    };

    const euler = new Euler(rotation.x, rotation.y, rotation.z, "XYZ");
    const threeQuat = new ThreeQuaternion().setFromEuler(euler);
    const rapierQuat = new RAPIER.Quaternion(threeQuat.x, threeQuat.y, threeQuat.z, threeQuat.w);

    const bodyDesc = (options.isStatic ? RAPIER.RigidBodyDesc.fixed() : RAPIER.RigidBodyDesc.dynamic())
    .setTranslation(position.x, position.y, position.z)
    .setRotation(rapierQuat);

    const body = world.createRigidBody(bodyDesc);

    if (typeof options.linearDamping === "number") body.setLinearDamping(options.linearDamping);
    if (typeof options.angularDamping === "number") body.setAngularDamping(options.angularDamping);

    this.handles.set(id, { body });
    return id;
  }

  removeBody(id: BodyId): void {
    const world = this.getWorld();
    const handle = this.handles.get(id);
    if (!handle) return;

    if (handle.collider) world.removeCollider(handle.collider, true);
    world.removeRigidBody(handle.body);

    this.handles.delete(id);
  }

  step(_delta: number): void {
    const world = this.getWorld();
    world.step();
  }

  dispose(): void {
    if (!this.world) return;

    for (const [id] of this.handles) this.removeBody(id);
    this.world = null;
    this.nextId = 0;
  }

  private getWorld(): RAPIER.World {
    if (!this.world) throw new Error("RapierPhysicsAdapter: init() doit être appelé avant usage");
    return this.world;
  }

  private newId(): BodyId {
    this.nextId += 1;
    return `body-${this.nextId}`;
  }
}