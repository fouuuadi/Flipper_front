import type { Object3D } from "three";

type FlipperSide = "left" | "right";

export class BlenderFlipperBridge {
  private readonly blenderMesh: Object3D;
  private readonly side: FlipperSide;
  private isActive = false;
  private currentDelta = 0;
  private readonly initialRotationY: number;
  private firstUpdate = true;

  constructor(side: FlipperSide, blenderMesh: Object3D) {
    this.side = side;
    this.blenderMesh = blenderMesh;
    this.initialRotationY = blenderMesh.rotation.y;

    console.log(
      `🔧 Bridge "${side}" pret — mesh="${blenderMesh.name}" initialY=${this.initialRotationY.toFixed(3)}`,
    );

    window.addEventListener("keydown", (e) => {
      if (side === "left" && e.code === "ShiftLeft") this.isActive = true;
      if (side === "right" && e.code === "ShiftRight") this.isActive = true;
    });

    window.addEventListener("keyup", (e) => {
      if (side === "left" && e.code === "ShiftLeft") this.isActive = false;
      if (side === "right" && e.code === "ShiftRight") this.isActive = false;
    });
  }

  update(deltaTime: number): void {
    if (this.firstUpdate) {
      console.log(`▶️ Bridge "${this.side}" premier update — rotation.y avant=${this.blenderMesh.rotation.y.toFixed(3)}`);
      this.firstUpdate = false;
    }

    const speed = 16;
    // Ici vers la gauche monte en positif, et vers la droite descend en negatif (meme signe que Flipper.ts)
    const sign = this.side === "left" ? 1 : -1;
    const target = this.isActive ? sign * 0.6 : 0;
    const diff = target - this.currentDelta;
    const step = Math.sign(diff) * Math.min(Math.abs(diff), speed * deltaTime);
    this.currentDelta += step;

    // Axe Y = swing horizontal dans le plan de la table
    this.blenderMesh.rotation.y = this.initialRotationY + this.currentDelta;
  }
}
