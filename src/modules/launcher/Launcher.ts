import * as THREE from "three";

export class Launcher {
  mesh: THREE.Mesh;

  constructor() {
    const geometry = new THREE.CylinderGeometry(0.2, 0.2, 2, 16);
    const material = new THREE.MeshStandardMaterial({ color: 0x888888 });

    this.mesh = new THREE.Mesh(geometry, material);

    // Position sur le côté (lane de lancement)
    this.mesh.position.set(3, 1, 4);

    this.mesh.castShadow = true;
    this.mesh.receiveShadow = true;
  }

  addTo(scene: THREE.Scene) {
    scene.add(this.mesh);
  }
}
