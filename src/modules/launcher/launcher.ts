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

    // Position sur le côté (lane de lancement)
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

        this.power = Math.min(this.chargeTime, this.maxCharge);
        this.chargeTime = 0;

        console.log("Launcher power:", this.power);
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
