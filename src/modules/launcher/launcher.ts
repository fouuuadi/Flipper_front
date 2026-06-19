import * as THREE from "three";
import type { Ball } from "@modules/ball";

export class Launcher {
  mesh: THREE.Mesh;
  // State
  private isCharging: boolean = false;
  private chargeTime: number = 0;
  private maxCharge: number = 1.4;

  private ball: Ball;

  private initialZ: number;
  // Constructor
  constructor(ball: Ball) {
    this.ball = ball;

    const geometry = new THREE.CylinderGeometry(0.2, 0.2, 2, 16);
    const material = new THREE.MeshStandardMaterial({ color: 0x888888 });

    this.mesh = new THREE.Mesh(geometry, material);

    // Position
    this.mesh.position.set(-7.6, 4.9, -13.4);

    // Inclinaison
    // léger angle vers la table
    this.mesh.rotation.x = -Math.PI / 3; // ~ -30°
    this.mesh.rotation.z = 0.15; // léger décalage esthétique

    this.mesh.castShadow = true;
    this.mesh.receiveShadow = true;

    this.initialZ = this.mesh.position.z;
  }

  /** Début de la charge (touche maintenue). L'input est câblé en dehors. */
  startCharge(): void {
    this.isCharging = true;
  }

  /** Relâche le lanceur : propulse la bille selon la charge accumulée. */
  release(): void {
    if (!this.isCharging) return;
    this.isCharging = false;

    const normalized = Math.min(this.chargeTime / this.maxCharge, 1);
    const easedPower = normalized * normalized;
    this.chargeTime = 0;

    // Impulsion vers le haut de la nouvelle table Blender (axe +z).
    const force = 0.35 + easedPower * 1.35;
    this.ball.applyImpulse({ x: 0, y: 0, z: force });
  }

  update(deltaTime: number) {
    if (this.isCharging) {
      this.chargeTime += deltaTime;
      this.chargeTime = Math.min(this.chargeTime, this.maxCharge);
    }

    // animation
    const compression = this.chargeTime / this.maxCharge;
    this.mesh.position.z = this.initialZ + compression * 0.75;
  }

  addTo(scene: THREE.Scene) {
    scene.add(this.mesh);
  }
}
