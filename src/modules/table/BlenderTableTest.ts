/**
 * BlenderTableTest.ts
 *
 * Module de validation visuelle du GLB Blender.
 * Objectifs :
 *   1. Charger /models/tableMarioGalaxy.glb dans la scène
 *   2. Logger tous les objets Blender pour vérification
 *   3. Récupérer flipper_left / flipper_right via getObjectByName
 *   4. Faire pivoter ces meshes avec ShiftLeft / ShiftRight
 *
 * ⚠️ Ce module est INDÉPENDANT : il ne touche pas à Rapier, ni aux
 *    classes Flipper / Launcher / Ball existantes.
 */

import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";

export function initBlenderTableTest(scene: THREE.Scene): void {
  const loader = new GLTFLoader();

  loader.load(
    "/models/tableMarioGalaxy.glb",

    // ── onLoad ──────────────────────────────────────────────────────────
    (gltf) => {
      const table = gltf.scene;
      scene.add(table);

      console.log("✅ Table Blender chargée");

      // Parcourir et afficher tous les objets du GLB
      table.traverse((obj) => {
        if (obj.name) {
          console.log("Objet Blender :", obj.name);
        }
      });

      // Récupérer les flippers Blender
      const flipperLeft = table.getObjectByName("flipper_left") ?? null;
      const flipperRight = table.getObjectByName("flipper_right") ?? null;

      if (flipperLeft) {
        console.log("✅ flipper_left trouvé — type :", flipperLeft.type);
      } else {
        console.warn("⚠️ flipper_left introuvable dans le GLB (vérifier le nom dans Blender)");
      }

      if (flipperRight) {
        console.log("✅ flipper_right trouvé — type :", flipperRight.type);
      } else {
        console.warn("⚠️ flipper_right introuvable dans le GLB (vérifier le nom dans Blender)");
      }

      // Test visuel : rotation au clavier (ShiftLeft / ShiftRight)
      // Note : les listeners Flipper.ts existants coexistent sans conflit.
      window.addEventListener("keydown", (event: KeyboardEvent) => {
        if (event.code === "ShiftLeft" && flipperLeft !== null) {
          flipperLeft.rotation.z += 0.3;
          console.log(
            "🎮 ShiftLeft → flipper_left (Blender) pivoté — rotation.z :",
            flipperLeft.rotation.z.toFixed(2),
          );
        }

        if (event.code === "ShiftRight" && flipperRight !== null) {
          flipperRight.rotation.z -= 0.3;
          console.log(
            "🎮 ShiftRight → flipper_right (Blender) pivoté — rotation.z :",
            flipperRight.rotation.z.toFixed(2),
          );
        }
      });
    },

    // ── onProgress ──────────────────────────────────────────────────────
    (progress) => {
      if (progress.total > 0) {
        const pct = Math.round((progress.loaded / progress.total) * 100);
        console.log(`⏳ Chargement GLB : ${pct}%`);
      }
    },

    // ── onError ─────────────────────────────────────────────────────────
    (error) => {
      console.error("❌ Erreur de chargement du GLB :", error);
    },
  );
}
