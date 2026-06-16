import type * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { BlenderFlipperBridge } from "./BlenderFlipperBridge";

export interface BlenderTableResult {
  bridges: BlenderFlipperBridge[];
}

<<<<<<< HEAD
export function loadBlenderTable(scene: THREE.Scene): Promise<BlenderTableResult> {
=======
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
>>>>>>> 98474e0 (fix(blender): repair table loader types and sync flippers to physics)
  return new Promise((resolve, reject) => {
    const loader = new GLTFLoader();

    loader.load(
      "/models/tableMarioGalaxy.glb",
      (gltf) => {
        scene.add(gltf.scene);

        const flipperLeftMesh = gltf.scene.getObjectByName("flipper_left") ?? null;
        const flipperRightMesh = gltf.scene.getObjectByName("flipper_right") ?? null;

<<<<<<< HEAD
        tableScene.traverse((obj) => {
          if (obj.name) {
            console.log(
              `   ▸ "${obj.name}" [${obj.type}]  pos=${obj.position.toArray().map((v) => +v.toFixed(2))}  scale=${obj.scale.toArray().map((v) => +v.toFixed(3))}`,
            );
          }
        });

        // ici on récupère les flippers, ils RESTENT dans la hiérarchie GLB (pas de scene.attach())
        const flipperLeftMesh = tableScene.getObjectByName("Flipper_left") ?? null;
        const flipperRightMesh = tableScene.getObjectByName("Flipper_right") ?? null;

        if (!flipperLeftMesh) console.warn("⚠️ Flipper_left introuvable dans le GLB");
        if (!flipperRightMesh) console.warn("⚠️ Flipper_right introuvable dans le GLB");

        if (flipperLeftMesh) {
          console.log("✅ Flipper_left  [" + flipperLeftMesh.type + "] visible=" + flipperLeftMesh.visible + " scale=" + flipperLeftMesh.scale.toArray());

          if (flipperLeftMesh.scale.lengthSq() === 0) {
            flipperLeftMesh.scale.set(1, 1, 1);
            console.log("🔧 Flipper_left scale forcé à (1,1,1)");
          }
        }
        if (flipperRightMesh) {
          console.log("✅ Flipper_right [" + flipperRightMesh.type + "] visible=" + flipperRightMesh.visible + " scale=" + flipperRightMesh.scale.toArray());
          if (flipperRightMesh.scale.lengthSq() === 0) {
            flipperRightMesh.scale.set(1, 1, 1);
            console.log("🔧 Flipper_right scale forcé à (1,1,1)");
          }
        }

        const bridges: BlenderFlipperBridge[] = [];

        if (flipperLeftMesh !== null) {
          bridges.push(new BlenderFlipperBridge("left", flipperLeftMesh));
          console.log("🔗 Bridge gauche prêt");
        }
        if (flipperRightMesh !== null) {
          bridges.push(new BlenderFlipperBridge("right", flipperRightMesh));
          console.log("🔗 Bridge droit prêt");
=======
        if (!flipperLeftMesh) console.warn('⚠️ "flipper_left" introuvable dans le GLB');
        if (!flipperRightMesh) console.warn('⚠️ "flipper_right" introuvable dans le GLB');

        const bridges: BlenderFlipperBridge[] = [];
        if (flipperLeftMesh) {
          bridges.push(new BlenderFlipperBridge(leftFlipper, flipperLeftMesh));
        }
        if (flipperRightMesh) {
          bridges.push(new BlenderFlipperBridge(rightFlipper, flipperRightMesh));
>>>>>>> 98474e0 (fix(blender): repair table loader types and sync flippers to physics)
        }

        resolve({ bridges });
      },
      undefined,
      (error) => reject(error),
    );
  });
}
