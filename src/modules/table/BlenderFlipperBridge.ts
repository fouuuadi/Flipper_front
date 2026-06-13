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
    // Only update Y rotation (swing angle). Position stays at Blender position.
    // Change to rotation.x or rotation.z if pivot axis differs in Blender export.
    this.blenderMesh.rotation.y = this.physicsFlipper.mesh.rotation.y;
  }
}






