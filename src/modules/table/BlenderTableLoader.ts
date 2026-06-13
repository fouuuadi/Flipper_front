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

        // Hiérarchie complète pour diagnostic
        tableScene.traverse((obj) => {
          if (obj.name) {
            console.log(`   ▸ "${obj.name}" [${obj.type}]  pos=${obj.position.toArray().map(v => +v.toFixed(2))}  scale=${obj.scale.toArray().map(v => +v.toFixed(3))}`);
          }
        });
}
