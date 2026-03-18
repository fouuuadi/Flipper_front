import * as THREE from "three";

export const PLAYFIELD_WIDTH = 5;
export const PLAYFIELD_HEIGHT = 10;
export const PLAYFIELD_TILT_DEG = 6.5;

export class Playfield {
  readonly mesh: THREE.Mesh;

  constructor() {
    const geometry = new THREE.PlaneGeometry(PLAYFIELD_WIDTH, PLAYFIELD_HEIGHT);
    const material = new THREE.MeshStandardMaterial({
      color: 0x1a472a,
      side: THREE.DoubleSide,
      roughness: 0.8,
      metalness: 0.1,
    });

    this.mesh = new THREE.Mesh(geometry, material);

    // Orienter le plan a l'horizontale (face vers le haut) puis incliner comme un vrai pinball
    this.mesh.rotation.x = -Math.PI / 2 + THREE.MathUtils.degToRad(PLAYFIELD_TILT_DEG);

    this.mesh.castShadow = true;
    this.mesh.receiveShadow = true;
  }

  addTo(scene: THREE.Scene): void {
    scene.add(this.mesh);
  }

  removeFrom(scene: THREE.Scene): void {
    scene.remove(this.mesh);
  }

  dispose(): void {
    this.mesh.geometry.dispose();
    (this.mesh.material as THREE.Material).dispose();
  }
}
