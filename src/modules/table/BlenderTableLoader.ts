import type * as THREE from "three";
import type RAPIER from "@dimforge/rapier3d-compat";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { BlenderFlipperBridge } from "./BlenderFlipperBridge";
import { createBlenderPhysicsColliders, type NamedPhysicsCollider } from "./BlenderPhysicsColliders";
import type { Flipper } from "@modules/flipper/Flipper";

export interface BlenderTableResult {
  bridges: BlenderFlipperBridge[];
  /** Racine de la table chargée (`gltf.scene`), pour ajustement de transform. */
  tableRoot: THREE.Object3D;
  /** Colliders nommés à conserver après le chargement (ex. "Slingshot_triangle"). */
  colliders: Record<string, NamedPhysicsCollider>;
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
  world: RAPIER.World,
): Promise<BlenderTableResult> {
  return new Promise((resolve, reject) => {
    const loader = new GLTFLoader();

    loader.load(
      "/models/tableMarioGalaxy.glb",
      (gltf) => {
        // Transform calé via la GUI debug 3D (DEV) puis figé ici.
        gltf.scene.position.set(1, 3.5, -3);
        gltf.scene.scale.setScalar(3);
        scene.add(gltf.scene);
        const colliders = createBlenderPhysicsColliders(
          gltf.scene,
          world,
          import.meta.env.DEV ? scene : undefined,
        );

        const flipperLeftMesh = gltf.scene.getObjectByName("Flipper_left") ?? null;
        const flipperRightMesh = gltf.scene.getObjectByName("Flipper_right") ?? null;

        if (!flipperLeftMesh) console.warn('⚠️ "flipper_left" introuvable dans le GLB');
        if (!flipperRightMesh) console.warn('⚠️ "flipper_right" introuvable dans le GLB');

        const bridges: BlenderFlipperBridge[] = [];
        if (flipperLeftMesh) {
          leftFlipper.fitColliderToVisualMesh(flipperLeftMesh);
          bridges.push(new BlenderFlipperBridge(leftFlipper, flipperLeftMesh));
        }
        if (flipperRightMesh) {
          rightFlipper.fitColliderToVisualMesh(flipperRightMesh);
          bridges.push(new BlenderFlipperBridge(rightFlipper, flipperRightMesh));
        }

        resolve({ bridges, tableRoot: gltf.scene, colliders });
      },
      undefined,
      (error) => reject(error),
    );
  });
}
