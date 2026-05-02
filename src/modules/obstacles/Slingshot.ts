import * as THREE from "three";

type SlingshotSide = "left" | "right";

export class Slingshot {
  mesh: THREE.Mesh;
  private side: SlingshotSide;

  constructor(side: SlingshotSide) {
    this.side = side;

    // === GEOMETRIE TRIANGLE ===
    const geometry = new THREE.BufferGeometry();

    const vertices = new Float32Array([
      0, 0, 0,   // point 1
      1, 0, 0,   // point 2
      0, 0, 1    // point 3
    ]);

    geometry.setAttribute(
      "position",
      new THREE.BufferAttribute(vertices, 3)
    );

    geometry.computeVertexNormals();

    const material = new THREE.MeshStandardMaterial({
      color: 0x00ff00,
      side: THREE.DoubleSide
    });

    this.mesh = new THREE.Mesh(geometry, material);

    // === POSITION ===
    if (this.side === "left") {
      this.mesh.position.set(-2, 0.5, 1);
    } else {
      this.mesh.position.set(2, 0.5, 1);
      this.mesh.rotation.y = Math.PI; // miroir
    }

    this.mesh.castShadow = true;
    this.mesh.receiveShadow = true;
  }

  addTo(scene: THREE.Scene) {
    scene.add(this.mesh);
  }
}
