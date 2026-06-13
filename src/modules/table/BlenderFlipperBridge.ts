import type { Object3D } from "three";
import type { Flipper } from "@modules/flipper/Flipper";

export class BlenderFlipperBridge {
  private readonly physicsFlipper: Flipper;
  private readonly blenderMesh: Object3D;

  constructor(physicsFlipper: Flipper, blenderMesh: Object3D) {
    this.physicsFlipper = physicsFlipper;
    this.blenderMesh = blenderMesh;
  }

  update(): void {
    this.blenderMesh.rotation.y = this.physicsFlipper.mesh.rotation.y;
  }
}






