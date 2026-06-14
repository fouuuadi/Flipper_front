import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { BlenderFlipperBridge } from "./BlenderFlipperBridge";
import type { Flipper } from "@modules/flipper/Flipper";

export interface BlenderTableResult {
  bridges: BlenderFlipperBridge[];
}

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
        const tableScene = gltf.scene;
        scene.add(tableScene);

        console.log("✅ Table Blender chargée");
        console.log("   scale racine :", tableScene.scale.toArray());

        tableScene.traverse((obj) => {
          if (obj.name) {
            console.log(`   ▸ "${obj.name}" [${obj.type}]  pos=${obj.position.toArray().map(v => +v.toFixed(2))}  scale=${obj.scale.toArray().map(v => +v.toFixed(3))}`);
          }
        });

        // Récupérer les flippers ils RESTENT dans la hiérarchie GLB
        const flipperLeftMesh  = tableScene.getObjectByName("flipper_left")  ?? null;
        const flipperRightMesh = tableScene.getObjectByName("flipper_right") ?? null;

        if (!flipperLeftMesh)  console.warn("⚠️ flipper_left introuvable dans le GLB");
        if (!flipperRightMesh) console.warn("⚠️ flipper_right introuvable dans le GLB");

        if (flipperLeftMesh)  console.log("✅ flipper_left  [" + flipperLeftMesh.type  + "] visible=" + flipperLeftMesh.visible);
        if (flipperRightMesh) console.log("✅ flipper_right [" + flipperRightMesh.type + "] visible=" + flipperRightMesh.visible);

        // Ici je met à jour uniquement rotation.y
        // La position Blender reste telle quelle pas de scene.attach()
        const bridges: BlenderFlipperBridge[] = [];

        if (flipperLeftMesh !== null) {
          bridges.push(new BlenderFlipperBridge(leftFlipper, flipperLeftMesh));
          console.log("🔗 Bridge gauche prêt");
        }
        if (flipperRightMesh !== null) {
          bridges.push(new BlenderFlipperBridge(rightFlipper, flipperRightMesh));
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
