import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";

export function initBlenderTableTest(scene: THREE.Scene): void {
  const loader = new GLTFLoader();

  loader.load(
    "/models/tableMarioGalaxy.glb",

  
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
  );
}