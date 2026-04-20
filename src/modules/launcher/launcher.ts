import * as THREE from "three";

export class Launcher {
  mesh: THREE.Mesh;

  private isCharging: boolean = false;
  private chargeTime: number = 0;
  private maxCharge: number = 2; // secondes
  private power: number = 0;

  constructor() {
    const geometry = new THREE.CylinderGeometry(0.2, 0.2, 2, 16);
    const material = new THREE.MeshStandardMaterial({ color: 0x888888 });

    this.mesh = new THREE.Mesh(geometry, material);

    // Position sur le côté (lane)
    this.mesh.position.set(3, 1, 4);

    this.mesh.castShadow = true;
    this.mesh.receiveShadow = true;

    // === INPUT CLAVIER ===
    window.addEventListener("keydown", (event) => {
      if (event.code === "Space") {
        this.isCharging = true;
      }
    });

    window.addEventListener("keyup", (event) => {
      if (event.code === "Space") {
        this.isCharging = false;

        // 👉 calcul de la puissance normalisée (0 → 1)
        const normalized = Math.min(this.chargeTime / this.maxCharge, 1);

        this.power = normalized;

        console.log("Launcher power (0-1):", this.power);

        // reset
        this.chargeTime = 0;
      }
    });
  }

  update(deltaTime: number) {
    if (this.isCharging) {
      this.chargeTime += deltaTime;
      this.chargeTime = Math.min(this.chargeTime, this.maxCharge);
    }
  }

  addTo(scene: THREE.Scene) {
    scene.add(this.mesh);
  }
}
