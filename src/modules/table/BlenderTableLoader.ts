import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { BlenderFlipperBridge } from "./BlenderFlipperBridge";

export interface BlenderTableResult {
  bridges: BlenderFlipperBridge[];
}

export function loadBlenderTable(scene: THREE.Scene): Promise<BlenderTableResult> {
  return new Promise((resolve, reject) => {
    const loader = new GLTFLoader();

    loader.load(
      "/models/tableMarioGalaxy.glb",

      (gltf) => {
        const tableScene = gltf.scene;
        scene.add(tableScene);

        console.log("✅ Table Blender chargée");
        console.log("   scale racine :", tableScene.scale.toArray());

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
        }

        resolve({ bridges });
      },

      (progress) => {
        if (progress.total > 0)
          console.log(`⏳ GLB : ${Math.round((progress.loaded / progress.total) * 100)}%`);
      },

      (error) => {
        console.error("❌ Erreur GLB :", error);
        reject(error);
      },
    );
  });
}
