import * as THREE from "three";
import RAPIER from "@dimforge/rapier3d-compat";

type FlipperSide = "left" | "right";

const FLIPPER_CONFIG = {
  left: {
    length: 1.85,
    height: 0.28,
    depth: 1.1,
    pivot: new THREE.Vector3(3.455, 4.802, -9.916),
    localOffset: new THREE.Vector3(-0.893, -0.131, -0.395),
    restAngle: 0.18,
    activeAngle: 0.86,
    minLimit: -0.22,
    maxLimit: 0.96,
  },
  right: {
    length: 1.66,
    height: 0.28,
    depth: 1.06,
    pivot: new THREE.Vector3(-1.097, 4.707, -10.05),
    localOffset: new THREE.Vector3(0.796, -0.13, -0.363),
    restAngle: -0.18,
    activeAngle: -0.86,
    minLimit: -0.96,
    maxLimit: 0.22,
  },
} satisfies Record<
  FlipperSide,
  {
    length: number;
    height: number;
    depth: number;
    pivot: THREE.Vector3;
    localOffset: THREE.Vector3;
    restAngle: number;
    activeAngle: number;
    minLimit: number;
    maxLimit: number;
  }
>;

export class Flipper {
  mesh: THREE.Mesh;
  debugMesh: THREE.Mesh;
  rigidBody: RAPIER.RigidBody;
  collider: RAPIER.Collider;

  private readonly world: RAPIER.World;
  private readonly pivot: THREE.Vector3;
  private isActive = false;
  private angle = 0;
  private readonly activeAngle: number;
  private readonly restAngle: number;
  private readonly minLimit: number;
  private readonly maxLimit: number;

  constructor(world: RAPIER.World, side: FlipperSide) {
    const config = FLIPPER_CONFIG[side];
    this.world = world;
    this.pivot = config.pivot.clone();

    const geometry = new THREE.BoxGeometry(config.length, config.height, config.depth);
    geometry.translate(config.localOffset.x, config.localOffset.y, config.localOffset.z);

    this.mesh = new THREE.Mesh(geometry, new THREE.MeshStandardMaterial({ color: 0xff0000 }));
    this.debugMesh = new THREE.Mesh(
      geometry.clone(),
      new THREE.MeshBasicMaterial({
        color: 0xfff000,
        wireframe: true,
        transparent: true,
        opacity: 0.9,
        depthTest: false,
      }),
    );
    this.mesh.position.copy(config.pivot);
    this.debugMesh.position.copy(config.pivot);
    this.debugMesh.renderOrder = 999;
    this.mesh.castShadow = true;
    this.mesh.receiveShadow = true;

    this.restAngle = config.restAngle;
    this.activeAngle = config.activeAngle;
    this.minLimit = config.minLimit;
    this.maxLimit = config.maxLimit;
    this.angle = this.restAngle;
    this.mesh.rotation.set(0, this.angle, 0, "XYZ");
    this.debugMesh.rotation.set(0, this.angle, 0, "XYZ");

    this.rigidBody = world.createRigidBody(
      RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(
        config.pivot.x,
        config.pivot.y,
        config.pivot.z,
      ),
    );

    this.collider = this.world.createCollider(
      RAPIER.ColliderDesc.roundCuboid(config.length / 2, config.height / 2, config.depth / 2, 0.08)
        .setTranslation(config.localOffset.x, config.localOffset.y, config.localOffset.z)
        .setFriction(0.55)
        .setRestitution(0.35),
      this.rigidBody,
    );

    const pivot = world.createRigidBody(
      RAPIER.RigidBodyDesc.fixed().setTranslation(config.pivot.x, config.pivot.y, config.pivot.z),
    );

    const jointData = RAPIER.JointData.revolute(
      { x: 0, y: 0, z: 0 },
      { x: 0, y: 0, z: 0 },
      { x: 0, y: 1, z: 0 },
    );

    jointData.limitsEnabled = true;
    jointData.limits = [this.minLimit, this.maxLimit];

    world.createImpulseJoint(jointData, pivot, this.rigidBody, true);
  }

  fitColliderToVisualMesh(object: THREE.Object3D): void {
    object.updateWorldMatrix(true, true);

    const points: number[] = [];
    const debugGeometry = new THREE.BufferGeometry();
    const debugPositions: number[] = [];
    const debugIndices: number[] = [];
    const restInverse = new THREE.Matrix4().makeRotationY(-this.restAngle);

    object.traverse((child) => {
      if (!(child instanceof THREE.Mesh)) return;
      const position = child.geometry.getAttribute("position");
      if (!position) return;

      const indexOffset = debugPositions.length / 3;
      const vertex = new THREE.Vector3();
      for (let i = 0; i < position.count; i += 1) {
        vertex
          .fromBufferAttribute(position, i)
          .applyMatrix4(child.matrixWorld)
          .sub(this.pivot)
          .applyMatrix4(restInverse);

        points.push(vertex.x, vertex.y, vertex.z);
        debugPositions.push(vertex.x, vertex.y, vertex.z);
      }

      const index = child.geometry.index;
      if (index) {
        for (let i = 0; i < index.count; i += 1) {
          debugIndices.push(index.getX(i) + indexOffset);
        }
      }
    });

    const colliderDesc =
      RAPIER.ColliderDesc.roundConvexHull(new Float32Array(points), 0.04) ??
      RAPIER.ColliderDesc.convexHull(new Float32Array(points));

    if (!colliderDesc) return;

    this.world.removeCollider(this.collider, true);
    this.collider = this.world.createCollider(
      colliderDesc.setFriction(0.55).setRestitution(0.4),
      this.rigidBody,
    );

    debugGeometry.setAttribute("position", new THREE.Float32BufferAttribute(debugPositions, 3));
    if (debugIndices.length > 0) {
      debugGeometry.setIndex(debugIndices);
    }

    this.debugMesh.geometry.dispose();
    this.debugMesh.geometry = debugGeometry;
  }

  press(): void {
    this.isActive = true;
  }

  release(): void {
    this.isActive = false;
  }

  update(deltaTime: number): void {
    const speed = 16;
    const target = this.isActive ? this.activeAngle : this.restAngle;
    const delta = target - this.angle;
    const step = Math.sign(delta) * Math.min(Math.abs(delta), speed * deltaTime);

    this.angle += step;
    this.angle = Math.max(this.minLimit, Math.min(this.maxLimit, this.angle));

    const threeQuat = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, this.angle, 0, "XYZ"));
    this.rigidBody.setNextKinematicRotation(
      new RAPIER.Quaternion(threeQuat.x, threeQuat.y, threeQuat.z, threeQuat.w),
    );

    this.mesh.rotation.set(0, this.angle, 0, "XYZ");
    this.debugMesh.rotation.set(0, this.angle, 0, "XYZ");
  }

  addTo(scene: THREE.Scene): void {
    scene.add(this.mesh);
  }

  addDebugTo(scene: THREE.Scene): void {
    scene.add(this.debugMesh);
  }
}
