import type * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { BlenderFlipperBridge } from "./BlenderFlipperBridge";
import type { Flipper } from "@modules/flipper/Flipper";

export interface BlenderTableResult {
  bridges: BlenderFlipperBridge[];
  /** Racine de la table chargée (`gltf.scene`), pour ajustement de transform. */
  tableRoot: THREE.Object3D;
}

/**
 * Charge la table modélisée sous Blender (GLB) dans la scène et branche un
 * bridge par flipper trouvé dans la hiérarchie GLB (`flipper_left` /
 * `flipper_right`) pour synchroniser leur visuel sur les flippers physiques.
 */
export function loadBlenderTable(
  scene: THREE.Scene,
  leftFlipper: Flipper,
  rightFlipper: Flipper,
): Promise<BlenderTableResult> {
  return new Promise((resolve, reject) => {
    const loader = new GLTFLoader();

    loader.load(
      "/models/tableMarioGalaxy.glb",
      (gltf) => {
        scene.add(gltf.scene);

        const flipperLeftMesh = gltf.scene.getObjectByName("flipper_left") ?? null;
        const flipperRightMesh = gltf.scene.getObjectByName("flipper_right") ?? null;

        if (!flipperLeftMesh) console.warn('⚠️ "flipper_left" introuvable dans le GLB');
        if (!flipperRightMesh) console.warn('⚠️ "flipper_right" introuvable dans le GLB');

        const bridges: BlenderFlipperBridge[] = [];
        if (flipperLeftMesh) {
          bridges.push(new BlenderFlipperBridge(leftFlipper, flipperLeftMesh));
        }
        if (flipperRightMesh) {
          bridges.push(new BlenderFlipperBridge(rightFlipper, flipperRightMesh));
        }

        resolve({ bridges, tableRoot: gltf.scene });
      },
      undefined,
      (error) => reject(error),
    );
  });
}
