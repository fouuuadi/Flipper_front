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

  // Fréquence de mise à jour du moteur physique
  private readonly fixedDt = 1 / 60; 
  private accumulator = 0;

  async init(): Promise<void> {
    if (this.world) return;

    await RAPIER.init();

    // inclinaison de la table
    const tilt = Math.PI / 30;
    // constante gravitationnelle (m/s²)
    const g = 9.81;

    this.world = new RAPIER.World({
      x: 0,
      y: -g * Math.cos(tilt),
      z: -g * Math.sin(tilt),
    });

    this.accumulator = 0;
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

    if (!options.isStatic) {
      body.enableCcd(true);
    }

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

    let density = 1.0; 

    if (typeof options.mass === "number") {
      if (shape === "sphere") {
        const radius = options.radius ?? 1;
        const volume = (4 / 3) * Math.PI * Math.pow(radius, 3);
        density = options.mass / volume;
      } else if (shape === "box") {
        const ext = options.halfExtents ?? { x: 1, y: 1, z: 1 };
        const volume = (2 * ext.x) * (2 * ext.y) * (2 * ext.z);
        density = options.mass / volume;
      }
    }

    colliderDesc = colliderDesc
      .setFriction(friction)
      .setRestitution(restitution)
      // .setDensity(density)
      .setSensor(false);

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

  step(deltaTime: number): void {
    const world = this.getWorld();

    const clampedDelta = Math.min(deltaTime, 0.1);
    this.accumulator += clampedDelta;

    const maxSubSteps = 5;
    let subSteps = 0;

    while (this.accumulator >= this.fixedDt && subSteps < maxSubSteps) {
      world.step();
      this.accumulator -= this.fixedDt;
      subSteps++;
    }

    if (subSteps === maxSubSteps) {
      this.accumulator = 0;
    }
  }

  dispose(): void {
    if (!this.world) return;

    for (const [id] of this.handles) {
      this.removeBody(id);
    }

    this.handles.clear();

    this.world = null;
    this.nextId = 0;
    this.accumulator = 0;

    console.debug("RapierPhysicsAdapter disposed");
  }

  // Helpers pour créer le monde de test

  /**
   * Crée le playfield statique : une large box plate, inclinée de 6° autour de X.
   * Dimensions approximatives : 1 m × 0.2 m × 2.5 m (largeur × épaisseur × longueur).
   */
  createPlayfield(options?: { y?: number; friction?: number; restitution?: number }): BodyId {
    const y = options?.y ?? 0;
    // const degree6 = Math.PI / 30;

    return this.addBody({
      id: "playfield",
      position: { x: 0, y, z: 0 },
      rotation: { x: 0, y: 0, z: 0 },
      isStatic: true,
      shape: "box",
      halfExtents: { x: 0.5, y: 0.2, z: 50 }, 
      friction: options?.friction ?? 0.7,
      restitution: options?.restitution ?? 0.2,
      
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
      friction: 0.2,
      restitution: 0.0,
      isStatic: false,
    });
  }

  // Méthode publique pour accéder à un body (debug)
  getBody(id: BodyId): RAPIER.RigidBody | null {
    const handle = this.handles.get(id);
    return handle?.body ?? null;
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