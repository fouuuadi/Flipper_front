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

    // Ici on gere la physique

    // RigidBody kinematic
    const rigidBodyDesc = RAPIER.RigidBodyDesc
      .kinematicPositionBased()
      .setTranslation(0, 0.5, 0);

    this.rigidBody = world.createRigidBody(rigidBodyDesc);

    // Collider
    const colliderDesc = RAPIER.ColliderDesc.cuboid(1, 0.15, 0.25);
    this.collider = world.createCollider(colliderDesc, this.rigidBody);

    // Ici on gere la rotation

    // Ajout du pivot
    const pivotDesc = RAPIER.RigidBodyDesc
      .fixed()
      .setTranslation(0, 0.5, 0);

    const pivot = world.createRigidBody(pivotDesc);

    // Ajout RevoluteJoint
    const jointData = RAPIER.JointData.revolute(
      { x: 0, y: 0, z: 0 },
      { x: 0, y: 0, z: 0 },
      { x: 0, y: 1, z: 0 }
    );

    // Ici on ajoute les limites d’angle
    jointData.limitsEnabled = true;
    jointData.limits = [-0.5, 0.5];

    // Ici on crée le joint
    world.createImpulseJoint(jointData, pivot, this.rigidBody, true);
  }

  addTo(scene: THREE.Scene) {
    scene.add(this.mesh);
  }
}
