import * as THREE from "three";

export class Flipper {
  mesh: THREE.Mesh;

  constructor() {
    // Ici j'ajoute les élements géometrique de base
    const geometry = new THREE.BoxGeometry(2, 0.3, 0.5);
    const material = new THREE.MeshStandardMaterial({ color: 0xff0000 });

    this.mesh = new THREE.Mesh(geometry, material);

    // ici j'ajoute la position de base
    this.mesh.position.set(0, 0.5, 0);

    // ici j'ajoute les ombres
    this.mesh.castShadow = true;
    this.mesh.receiveShadow = true;
  }

  addTo(scene: THREE.Scene) {
    scene.add(this.mesh);
  }
}
