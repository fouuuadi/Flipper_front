import * as THREE from "three";
import RAPIER from "@dimforge/rapier3d-compat";

export class Flipper {
  mesh: THREE.Mesh;
  rigidBody: RAPIER.RigidBody;
  collider: RAPIER.Collider;

  private isActive: boolean = false;

  constructor(world: RAPIER.World) {

    const geometry = new THREE.BoxGeometry(2, 0.3, 0.5);
    const material = new THREE.MeshStandardMaterial({ color: 0xff0000 });

    this.mesh = new THREE.Mesh(geometry, material);
    this.mesh.position.set(0, 0.5, 0);

    this.mesh.castShadow = true;
    this.mesh.receiveShadow = true;

    // Ici je gére la physique

    const rigidBodyDesc = RAPIER.RigidBodyDesc
      .kinematicPositionBased()
      .setTranslation(0, 0.5, 0);

    this.rigidBody = world.createRigidBody(rigidBodyDesc);

    const colliderDesc = RAPIER.ColliderDesc.cuboid(1, 0.15, 0.25);
    this.collider = world.createCollider(colliderDesc, this.rigidBody);

    const pivotDesc = RAPIER.RigidBodyDesc
      .fixed()
      .setTranslation(0, 0.5, 0);

    const pivot = world.createRigidBody(pivotDesc);

    const jointData = RAPIER.JointData.revolute(
      { x: 0, y: 0, z: 0 },
      { x: 0, y: 0, z: 0 },
      { x: 0, y: 1, z: 0 }
    );

    jointData.limitsEnabled = true;
    jointData.limits = [-0.5, 0.5];

    world.createImpulseJoint(jointData, pivot, this.rigidBody, true);

    // Ici je gere les input du clavier

    window.addEventListener("keydown", (event) => {
      if (event.code === "ShiftLeft") {
        this.isActive = true;
      }
    });

    window.addEventListener("keyup", (event) => {
      if (event.code === "ShiftLeft") {
        this.isActive = false;
      }
    });
  }

  update(deltaTime: number) {
    if (this.isActive) {

    }
  }

  addTo(scene: THREE.Scene) {
    scene.add(this.mesh);
  }
}
