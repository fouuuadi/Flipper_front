import * as THREE from "three";
import RAPIER from "@dimforge/rapier3d-compat";

export class Flipper {
  mesh: THREE.Mesh;
  rigidBody: RAPIER.RigidBody;
  collider: RAPIER.Collider;

  constructor(world: RAPIER.World) {

    const geometry = new THREE.BoxGeometry(2, 0.3, 0.5);
    const material = new THREE.MeshStandardMaterial({ color: 0xff0000 });

    this.mesh = new THREE.Mesh(geometry, material);
    this.mesh.position.set(0, 0.5, 0);

    this.mesh.castShadow = true;
    this.mesh.receiveShadow = true;

    // Ici on gére la physique

    // RigidBody kinematic
    const rigidBodyDesc = RAPIER.RigidBodyDesc
      .kinematicPositionBased()
      .setTranslation(0, 0.5, 0);

    this.rigidBody = world.createRigidBody(rigidBodyDesc);

    // Collider
    const colliderDesc = RAPIER.ColliderDesc.cuboid(1, 0.15, 0.25);
    this.collider = world.createCollider(colliderDesc, this.rigidBody);
  }

  addTo(scene: THREE.Scene) {
    scene.add(this.mesh);
  }
}
