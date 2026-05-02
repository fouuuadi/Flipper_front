import * as THREE from "three";
import RAPIER from "@dimforge/rapier3d-compat";
import { Ball } from "@modules/ball";
import { EventBus } from "@core";

type SlingshotSide = "left" | "right";

export class Slingshot {
  mesh: THREE.Mesh;
  private side: SlingshotSide;

  rigidBody!: RAPIER.RigidBody;
  collider!: RAPIER.Collider;

  // Ici, on crée une simple géométrie de triangle pour représenter le slingshot
  private material: THREE.MeshStandardMaterial;
  private hitTimer: number = 0;

  constructor(world: RAPIER.World, side: SlingshotSide) {
    this.side = side;

    const geometry = new THREE.BufferGeometry();

    const vertices = new Float32Array([
      0, 0, 0,
      1, 0, 0,
      0, 0, 1,
    ]);

    geometry.setAttribute(
      "position",
      new THREE.BufferAttribute(vertices, 3)
    );

    geometry.computeVertexNormals();

    this.material = new THREE.MeshStandardMaterial({
      color: 0x00ff00,
      side: THREE.DoubleSide,
    });

    this.mesh = new THREE.Mesh(geometry, this.material);

    const x = this.side === "left" ? -2 : 2;

    this.mesh.position.set(x, 0.5, 1);

    if (this.side === "right") {
      this.mesh.rotation.y = Math.PI;
    }

    this.mesh.castShadow = true;
    this.mesh.receiveShadow = true;

    // Ici on gere le positionnement du slingshot
    const rigidBodyDesc = RAPIER.RigidBodyDesc.fixed().setTranslation(
      x,
      0.5,
      1
    );

    this.rigidBody = world.createRigidBody(rigidBodyDesc);

    const colliderDesc = RAPIER.ColliderDesc.cuboid(0.5, 0.1, 0.5);

    this.collider = world.createCollider(colliderDesc, this.rigidBody);
  }

  update(ball: Ball, deltaTime: number) {
    const world = (ball as any).physics.getWorld();
    const ballBody = (ball as any).rigidBody;

    if (!ballBody) return;

    const contact = world.contactPair(this.collider, ballBody);

    if (contact) {
      // Impulsion
      const force = 2;
      const direction = this.side === "left" ? 1 : -1;

      ballBody.applyImpulse(
        {
          x: force * direction,
          y: 0,
          z: -force,
        },
        true
      );

      // Event
      EventBus.emit("slingshot_hit", {
        side: this.side,
      });

  addTo(scene: THREE.Scene) {
    scene.add(this.mesh);
  }
}
