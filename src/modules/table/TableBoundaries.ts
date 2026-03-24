import * as THREE from "three";
import RAPIER from "@dimforge/rapier3d-compat";
import type { BodyId } from "@physics/PhysicsAdapter";
import {
  PLAYFIELD_HEIGHT,
  PLAYFIELD_TILT_DEG,
  PLAYFIELD_WIDTH,
} from "@modules/playfield/Playfield";

interface BoundaryElement {
  mesh: THREE.Mesh;
  bodyId: BodyId;
}

interface WallSpec {
  id: BodyId;
  x: number;
  z: number;
  width: number;
  height: number;
  depth: number;
  color: number;
  yaw?: number;
}

export class TableBoundaries {
  private readonly world: RAPIER.World;
  private readonly elements: BoundaryElement[] = [];

  private readonly wallHeight = 0.32;
  private readonly wallThickness = 0.14;
  private readonly railHeight = 0.2;
  private readonly railThickness = 0.1;
  private readonly playfieldPitch = THREE.MathUtils.degToRad(PLAYFIELD_TILT_DEG);

  private readonly halfWidth = PLAYFIELD_WIDTH / 2;
  private readonly halfLength = PLAYFIELD_HEIGHT / 2;

  constructor(world: RAPIER.World) {
    this.world = world;
  }

  private yOnPlayfield(z: number, height: number): number {
    return 0.12 + height / 2 - Math.tan(this.playfieldPitch) * z;
  }

  private createWall(spec: WallSpec): void {
    const position = new THREE.Vector3(spec.x, this.yOnPlayfield(spec.z, spec.height), spec.z);
    const yaw = spec.yaw ?? 0;

    const mesh = new THREE.Mesh(
      new THREE.BoxGeometry(spec.width, spec.height, spec.depth),
      new THREE.MeshStandardMaterial({ color: spec.color, roughness: 0.7, metalness: 0.12 }),
    );

    mesh.position.copy(position);
    mesh.rotation.set(this.playfieldPitch, yaw, 0, "XYZ");
    mesh.castShadow = true;
    mesh.receiveShadow = true;

    const rigidBody = this.world.createRigidBody(
      RAPIER.RigidBodyDesc.fixed().setTranslation(position.x, position.y, position.z),
    );

    const halfExtents = {
      x: spec.width / 2,
      y: spec.height / 2,
      z: spec.depth / 2,
    };

    const rotationQuat = new THREE.Quaternion().setFromEuler(
      new THREE.Euler(this.playfieldPitch, yaw, 0, "XYZ"),
    );

    const colliderDesc = RAPIER.ColliderDesc.cuboid(halfExtents.x, halfExtents.y, halfExtents.z)
      .setRotation({
        x: rotationQuat.x,
        y: rotationQuat.y,
        z: rotationQuat.z,
        w: rotationQuat.w,
      })
      .setFriction(0.35)
      .setRestitution(0.18);

    this.world.createCollider(colliderDesc, rigidBody);
    this.elements.push({ mesh, bodyId: spec.id });
  }

  private createOuterWalls(): void {
    const bottomZ = this.halfLength - this.wallThickness / 2;
    const drainOpeningWidth = 2.0;
    const bottomSegmentWidth = (PLAYFIELD_WIDTH - drainOpeningWidth) / 2;
    const leftBottomCenterX = -drainOpeningWidth / 2 - bottomSegmentWidth / 2;
    const rightBottomCenterX = drainOpeningWidth / 2 + bottomSegmentWidth / 2;

    this.createWall({
      id: "wall-left",
      x: -this.halfWidth + this.wallThickness / 2,
      z: 0,
      width: this.wallThickness,
      height: this.wallHeight,
      depth: PLAYFIELD_HEIGHT,
      color: 0x3c3c3c,
    });

    this.createWall({
      id: "wall-right",
      x: this.halfWidth - this.wallThickness / 2,
      z: 0,
      width: this.wallThickness,
      height: this.wallHeight,
      depth: PLAYFIELD_HEIGHT,
      color: 0x3c3c3c,
    });

    this.createWall({
      id: "wall-back",
      x: 0,
      z: -this.halfLength + this.wallThickness / 2,
      width: PLAYFIELD_WIDTH,
      height: this.wallHeight,
      depth: this.wallThickness,
      color: 0x4e4e4e,
    });

    this.createWall({
      id: "wall-bottom-left",
      x: leftBottomCenterX,
      z: bottomZ,
      width: bottomSegmentWidth,
      height: this.wallHeight,
      depth: this.wallThickness,
      color: 0x4b4b4b,
    });

    this.createWall({
      id: "wall-bottom-right",
      x: rightBottomCenterX,
      z: bottomZ,
      width: bottomSegmentWidth,
      height: this.wallHeight,
      depth: this.wallThickness,
      color: 0x4b4b4b,
    });
  }

  private createFlipperGuideRails(): void {
    const guideX = this.halfWidth - 0.95;

    this.createWall({
      id: "rail-guide-left-outer",
      x: -guideX,
      z: 3.2,
      width: this.railThickness,
      height: this.railHeight,
      depth: 1.9,
      color: 0x6d6d6d,
      yaw: 0.34,
    });

    this.createWall({
      id: "rail-guide-right-outer",
      x: guideX,
      z: 3.2,
      width: this.railThickness,
      height: this.railHeight,
      depth: 1.9,
      color: 0x6d6d6d,
      yaw: -0.34,
    });
  }

  private createLauncherLane(): void {
    const laneInnerX = this.halfWidth - 0.7;
    const laneCapWidth = 0.78;

    this.createWall({
      id: "launcher-lane-inner-wall",
      x: laneInnerX,
      z: 1.1,
      width: this.wallThickness,
      height: this.wallHeight,
      depth: 7.8,
      color: 0x2d5b2d,
    });

    this.createWall({
      id: "launcher-lane-bottom-cap",
      x: this.halfWidth - laneCapWidth / 2,
      z: this.halfLength - this.wallThickness / 2,
      width: laneCapWidth,
      height: this.wallHeight,
      depth: this.wallThickness,
      color: 0x2d5b2d,
    });
  }

  addTo(scene: THREE.Scene): void {
    this.createOuterWalls();
    this.createFlipperGuideRails();
    this.createLauncherLane();

    this.elements.forEach((element) => scene.add(element.mesh));
  }

  removeFrom(scene: THREE.Scene): void {
    this.elements.forEach((element) => scene.remove(element.mesh));
  }

  dispose(): void {
    this.elements.forEach((element) => {
      element.mesh.geometry.dispose();
      (element.mesh.material as THREE.Material).dispose();
    });
    this.elements.length = 0;
  }
}
