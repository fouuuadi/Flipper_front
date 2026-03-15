import * as RAPIER from "@dimforge/rapier3d-compat";
import type { BodyId, BodyOptions, PhysicsAdapter, Vec3 } from "./PhysicsAdapter";
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

    // Constante gravitationnelle vectorielle sur l'axe y
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

    // Collider
    const shape = options.shape ?? "sphere";
    const friction = options.friction ?? 0.7;
    const restitution = options.restitution ?? 0.5;

    let colliderDesc: RAPIER.ColliderDesc;
    if (shape === "box") {
      const ext = options.halfExtents ?? { x: 1, y: 1, z: 1 };
      colliderDesc = RAPIER.ColliderDesc.cuboid(ext.x, ext.y, ext.z);
    } else {
      const radius = options.radius ?? 1;
      colliderDesc = RAPIER.ColliderDesc.ball(radius);
    } 

    // réaction de support : plus le frottement est élevé, moins la balle glisse sur la surface.
    // rebond : plus la restitution est élevé, plus la balle rebondit après une collision.
    colliderDesc = colliderDesc.setFriction(friction).setRestitution(restitution);

    if (typeof options.mass === "number") {
      colliderDesc = colliderDesc.setMass(options.mass);
    }

    const collider = world.createCollider(colliderDesc, body);

    // pertes de vitesse : plus la résistance est élevé, plus la balle ralentit au fil du temps.
    if (typeof options.linearDamping === "number") body.setLinearDamping(options.linearDamping);
    if (typeof options.angularDamping === "number") body.setAngularDamping(options.angularDamping);

    this.handles.set(id, { body, collider });
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

  // Helpers pour créer le monde de test

  /**
   * Crée le playfield statique : une large box plate, inclinée de 6° autour de X.
   * Dimensions approximatives : 1 m × 0.2 m × 2.5 m (largeur × épaisseur × longueur).
   */
  createPlayfield(options?: { y?: number; friction?: number; restitution?: number }): BodyId {
    const y = options?.y ?? 0;
    const degree6 = Math.PI / 30;

    return this.addBody({
      id: "playfield",
      position: { x: 0, y, z: 0 },
      rotation: { x: degree6, y: 0, z: 0 },
      shape: "box",
      halfExtents: { x: 0.5, y: 0.1, z: 1.25 }, 
      friction: options?.friction ?? 0.7,
      restitution: options?.restitution ?? 0.3,
      isStatic: true,
    });
  }

  /**
   * Crée une balle de test : sphère dynamique au-dessus du playfield.
   * Masse : 0.08 kg (80 g, réaliste pour une bille de pinball).
   * Rayon : 0.014 m (14 mm).
   */

  createTestBall(options?: {
    position?: Vec3;
    radius?: number;
    mass?: number;
    linearDamping?: number;
  }): BodyId {
    const pos = options?.position ?? { x: 0, y: 1, z: 0 };
    const radius = options?.radius ?? 0.014;
    const mass = options?.mass ?? 0.08;
    const linearDamping = options?.linearDamping ?? 0.1;

    return this.addBody({
      id: "test-ball",
      position: pos,
      shape: "sphere",
      radius,
      mass,
      linearDamping,
      angularDamping: 0.1,
      friction: 0.3,
      restitution: 0.85,
      isStatic: false,
    });
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