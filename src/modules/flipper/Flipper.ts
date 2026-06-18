import * as THREE from "three";
import RAPIER from "@dimforge/rapier3d-compat";
import { PLAYFIELD_TILT_DEG } from "@modules/playfield/Playfield";

type FlipperSide = "left" | "right";

export class Flipper {
  mesh: THREE.Mesh;
  rigidBody: RAPIER.RigidBody;
  collider: RAPIER.Collider;

  private isActive = false;
  private angle = 0;
  private readonly activeAngle: number;
  private readonly restAngle: number;
  private readonly minLimit: number;
  private readonly maxLimit: number;
  private readonly playfieldPitch: number;

  constructor(world: RAPIER.World, side: FlipperSide) {
    const flipperLength = 0.86;
    const flipperHeight = 0.18;
    const flipperDepth = 0.28;
    const hingeInset = 0.08;
    const localOffsetX =
      side === "left" ? flipperLength / 2 - hingeInset : -(flipperLength / 2 - hingeInset);

    const geometry = new THREE.BoxGeometry(flipperLength, flipperHeight, flipperDepth);
    geometry.translate(localOffsetX, 0, 0);
    const material = new THREE.MeshStandardMaterial({ color: 0xff0000 });

    this.mesh = new THREE.Mesh(geometry, material);

    const xOffset = side === "left" ? 0.82 : -0.68;
    const zPosition = -2.33;
    const yPosition = side === "left" ? 0.43 : 0.4;
    this.playfieldPitch = -THREE.MathUtils.degToRad(PLAYFIELD_TILT_DEG);

    this.restAngle = side === "left" ? 0.18 : -0.18;
    this.activeAngle = side === "left" ? 0.78 : -0.78;
    this.minLimit = side === "left" ? -0.28 : -0.92;
    this.maxLimit = side === "left" ? 0.92 : 0.28;
    this.angle = this.restAngle;

    this.mesh.position.set(xOffset, yPosition, zPosition);
    this.mesh.rotation.set(this.playfieldPitch, this.angle, 0, "XYZ");

    this.mesh.castShadow = true;
    this.mesh.receiveShadow = true;

    // Ici on gére la physique

    const rigidBodyDesc = RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(
      xOffset,
      yPosition,
      zPosition,
    );

    this.rigidBody = world.createRigidBody(rigidBodyDesc);

    const colliderDesc = RAPIER.ColliderDesc.cuboid(
      flipperLength / 2,
      flipperHeight / 2,
      flipperDepth / 2,
    )
      .setTranslation(localOffsetX, 0, 0)
      .setFriction(0.55)
      .setRestitution(0.2);
    this.collider = world.createCollider(colliderDesc, this.rigidBody);

    const pivotDesc = RAPIER.RigidBodyDesc.fixed().setTranslation(xOffset, yPosition, zPosition);

    const pivot = world.createRigidBody(pivotDesc);

    const jointData = RAPIER.JointData.revolute(
      { x: 0, y: 0, z: 0 },
      { x: 0, y: 0, z: 0 },
      { x: 0, y: 1, z: 0 },
    );

    jointData.limitsEnabled = true;
    jointData.limits = [this.minLimit, this.maxLimit];

    world.createImpulseJoint(jointData, pivot, this.rigidBody, true);
  }

  /** Active le flipper (touche pressée). */
  press(): void {
    this.isActive = true;
  }

  /** Relâche le flipper (touche relâchée). */
  release(): void {
    this.isActive = false;
  }

  update(deltaTime: number) {
    const speed = 16;
    const target = this.isActive ? this.activeAngle : this.restAngle;
    const delta = target - this.angle;
    const step = Math.sign(delta) * Math.min(Math.abs(delta), speed * deltaTime);

    this.angle += step;
    this.angle = Math.max(this.minLimit, Math.min(this.maxLimit, this.angle));

    // Ici on gére la rotation
    const threeQuat = new THREE.Quaternion().setFromEuler(
      new THREE.Euler(this.playfieldPitch, this.angle, 0, "XYZ"),
    );

    const rotation = new RAPIER.Quaternion(threeQuat.x, threeQuat.y, threeQuat.z, threeQuat.w);

    this.rigidBody.setNextKinematicRotation(rotation);

    this.mesh.rotation.set(this.playfieldPitch, this.angle, 0, "XYZ");
  }

  addTo(scene: THREE.Scene) {
    scene.add(this.mesh);
  }
}
