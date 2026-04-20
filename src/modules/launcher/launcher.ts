import * as THREE from "three";
import { Ball } from "@modules/ball";
import { EventBus } from "@core";

export class Launcher {
  mesh: THREE.Mesh;

  private isCharging: boolean = false;
  private chargeTime: number = 0;
  private maxCharge: number = 2;
  private power: number = 0;

  private ball: Ball;

  // animation
  private initialZ: number;

  constructor(ball: Ball) {
    this.ball = ball;

    const geometry = new THREE.CylinderGeometry(0.2, 0.2, 2, 16);
    const material = new THREE.MeshStandardMaterial({ color: 0x888888 });

    this.mesh = new THREE.Mesh(geometry, material);

    this.mesh.position.set(3, 1, 4);

    this.mesh.castShadow = true;
    this.mesh.receiveShadow = true;

    this.initialZ = this.mesh.position.z;

    // === INPUT ===
    window.addEventListener("keydown", (event) => {
      if (event.code === "Space") {
        this.isCharging = true;
      }
    });

    window.addEventListener("keyup", (event) => {
      if (event.code === "Space") {
        this.isCharging = false;

        // puissance normalisée
        const normalized = Math.min(this.chargeTime / this.maxCharge, 1);
        this.power = normalized;

        this.chargeTime = 0;

        // === IMPULSION ===
        const force = this.power * 10;

        const rigidBody = (this.ball as any).rigidBody;

        if (rigidBody) {
          rigidBody.applyImpulse({ x: 0, y: 0, z: -force }, true);
        }

        // === EVENT ===
        EventBus.emit("ball_launched", {
          power: this.power,
        });

        console.log("Ball launched with power:", this.power);
      }
    });
  }

  update(deltaTime: number) {
    if (this.isCharging) {
      this.chargeTime += deltaTime;
      this.chargeTime = Math.min(this.chargeTime, this.maxCharge);
    }

    const compression = this.chargeTime / this.maxCharge;
    this.mesh.position.z = this.initialZ + compression * 1;
  }

  addTo(scene: THREE.Scene) {
    scene.add(this.mesh);
  }
}
