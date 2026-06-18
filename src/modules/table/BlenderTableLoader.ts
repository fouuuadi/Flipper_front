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
        // Transform calé via la GUI debug 3D (DEV) puis figé ici.
        gltf.scene.position.set(1, 3.5, -3);
        gltf.scene.scale.setScalar(3);
        scene.add(gltf.scene);

        const flipperLeftMesh = gltf.scene.getObjectByName("flipper_left") ?? null;
        const flipperRightMesh = gltf.scene.getObjectByName("flipper_right") ?? null;

        if (!flipperLeftMesh) console.warn('⚠️ "flipper_left" introuvable dans le GLB');
        if (!flipperRightMesh) console.warn('⚠️ "flipper_right" introuvable dans le GLB');

        // [DEBUG] Diagnostic demandé : dimensions monde RÉELLES des meshes
        // flipper Blender, à comparer avec les constantes estimées à la main
        // dans Flipper.ts (flipperLength = 0.86, flipperDepth = 0.28) — si ça
        // ne correspond pas, le collider physique (taille fixe, basée sur ces
        // constantes) ne couvre pas le même volume que le visuel Blender.
        for (const mesh of [flipperLeftMesh, flipperRightMesh]) {
          if (!mesh) continue;
          mesh.updateWorldMatrix(true, false);
          const box = new THREE.Box3().setFromObject(mesh);
          const size = box.getSize(new THREE.Vector3());
          const center = box.getCenter(new THREE.Vector3());
          console.log(
            `📏 Bounding box monde de "${mesh.name}" : taille=(${size.x.toFixed(3)}, ${size.y.toFixed(3)}, ${size.z.toFixed(3)}) | centre=(${center.x.toFixed(3)}, ${center.y.toFixed(3)}, ${center.z.toFixed(3)})`,
          );
        }

        const bridges: BlenderFlipperBridge[] = [];
        if (flipperLeftMesh) {
<<<<<<< Updated upstream
          bridges.push(new BlenderFlipperBridge(leftFlipper, flipperLeftMesh));
        }
        if (flipperRightMesh) {
          bridges.push(new BlenderFlipperBridge(rightFlipper, flipperRightMesh));
        }

        resolve({ bridges, tableRoot: gltf.scene });
=======
          // [DEBUG] `scene` passé pour activer le wireframe cyan de
          // diagnostic (englobe le VRAI mesh Blender, sans calcul maison —
          // cf. BlenderFlipperBridge.ts) à comparer avec le vert du collider.
          bridges.push(new BlenderFlipperBridge(leftFlipper, flipperLeftMesh, scene));
          console.log("🔗 Bridge gauche prêt");
        }
        if (flipperRightMesh) {
          bridges.push(new BlenderFlipperBridge(rightFlipper, flipperRightMesh, scene));
          console.log("🔗 Bridge droit prêt");
        }

        // [FIX] Demandé : que le carré vert (collider) englobe EXACTEMENT le
        // vrai mesh Blender "Flipper_left"/"Flipper_right", au lieu des
        // dimensions estimées à la main dans Flipper.ts (qui ne collaient
        // jamais : ni la hauteur, ni l'angle apparent). On le fait ici, une
        // fois le GLB chargé et les bounding box réelles connues.
        if (flipperLeftMesh) leftFlipper.fitToBlenderMesh(flipperLeftMesh, physics.getWorld());
        if (flipperRightMesh) rightFlipper.fitToBlenderMesh(flipperRightMesh, physics.getWorld());

        // Ici on recherche le "Plane" la surface de jeu
        function findPlayfieldPlane(): THREE.Mesh | null {
          const exact = tableScene.getObjectByName("Plane");
          if (exact && (exact as THREE.Mesh).isMesh) return exact as THREE.Mesh;

          let fallback: THREE.Mesh | null = null;
          tableScene.traverse((obj) => {
            if (fallback || !obj.name || !(obj as THREE.Mesh).isMesh) return;
            const lower = obj.name.toLowerCase();
            if (lower.includes("plane") || lower.includes("playfield")) {
              fallback = obj as THREE.Mesh;
            }
          });
          if (fallback) {
            console.log(`🔎 Playfield trouvé via recherche tolérante : "${fallback.name}"`);
          }
          return fallback;
        }

        const planeMesh = findPlayfieldPlane();

        if (planeMesh) {
          const { vertices, indices } = buildTrimeshFromMesh(planeMesh);

          physics.removeBody("playfield");
          physics.addBody({
            id: "playfield",
            position: { x: 0, y: 0, z: 0 },
            rotation: { x: 0, y: 0, z: 0 },
            isStatic: true,
            shape: "trimesh",
            vertices,
            indices,
            friction: 0.25, // plateau lisse type pinball — la balle doit rouler, pas freiner
            restitution: 0.0,
          });
          console.log(`✅ Sol physique remplacé par le collider exact de "${planeMesh.name}"`);

          // Diagnostic : hauteur réelle du sol près des flippers (z≈-2.33),
          // pour vérifier qu'elle correspond bien à la hauteur (y) utilisée
          // par les colliders de flippers dans Flipper.ts.
          const box = new THREE.Box3().setFromBufferAttribute(
            new THREE.BufferAttribute(vertices, 3),
          );
          console.log(
            `📏 Bounding box du sol "Plane" (monde) : y min=${box.min.y.toFixed(3)} max=${box.max.y.toFixed(3)} | z min=${box.min.z.toFixed(3)} max=${box.max.z.toFixed(3)}`,
          );

          // [DEBUG] La bounding box globale ne dit pas la hauteur LOCALE du sol
          // pile entre les deux flippers (x≈0, z≈-2.3) — zone où la balle reste
          // bloquée même après avoir réduit le collider des flippers. Si le sol
          // a une bosse/relief à cet endroit précis (ex: un poteau central, une
          // jonction de maillage), ça expliquerait un blocage indépendant des
          // flippers. On filtre les vertices du sol proches de cette zone pour
          // connaître leur hauteur réelle.
          let localMinY = Infinity;
          let localMaxY = -Infinity;
          let localCount = 0;
          for (let i = 0; i < vertices.length; i += 3) {
            const vx = vertices[i];
            const vy = vertices[i + 1];
            const vz = vertices[i + 2];
            if (Math.abs(vx) < 0.4 && vz > -2.7 && vz < -1.9) {
              localMinY = Math.min(localMinY, vy);
              localMaxY = Math.max(localMaxY, vy);
              localCount++;
            }
          }
          if (localCount > 0) {
            console.log(
              `📏 Hauteur LOCALE du sol entre les flippers (x≈0, z≈[-2.7,-1.9], ${localCount} vertices) : y min=${localMinY.toFixed(3)} max=${localMaxY.toFixed(3)}`,
            );
          } else {
            console.warn("⚠️ Aucun vertex du sol trouvé dans la zone entre les flippers (x≈0, z≈[-2.7,-1.9]) — maillage trop grossier pour ce filtre, voir le raycast ci-dessous.");
          }

          // [DEBUG] Test plus fiable que le filtre de vertices ci-dessus : un
          // rayon vertical, qui touche la vraie surface interpolée du sol
          // (peu importe la densité du maillage), pile à l'endroit où la balle
          // reste bloquée (x=0, z=-2.3). Si la hauteur trouvée ici correspond
          // à la hauteur où la balle flotte, ça confirme que c'est le SOL
          // Blender (pas le collider du flipper) qui bloque.
          const raycaster = new THREE.Raycaster(
            new THREE.Vector3(0, 5, -2.3),
            new THREE.Vector3(0, -1, 0),
          );
          const groundHits = raycaster.intersectObject(planeMesh, true);
          if (groundHits.length > 0) {
            console.log(
              `📍 Raycast sol à x=0, z=-2.3 : y=${groundHits[0].point.y.toFixed(3)} (touché à ${groundHits[0].distance.toFixed(3)}m du point de départ)`,
            );
          } else {
            console.warn("⚠️ Raycast n'a touché aucune surface du sol à x=0, z=-2.3");
          }
        } else {
          console.warn(
            '⚠️ "Plane" introuvable dans le GLB (même en recherche tolérante) — le sol de secours approximatif reste actif.',
          );
        }

        // Ici on gere les murs de la table Blender ("_wall_one", "_wall_two", 
        // "wall_six", ...)
        function findWallMeshes(): THREE.Mesh[] {
          const meshes: THREE.Mesh[] = [];
          const seen = new Set<THREE.Object3D>();
          tableScene.traverse((obj) => {
            if (!obj.name || !/^_?wall/i.test(obj.name)) return;
            obj.traverse((descendant) => {
              const candidate = descendant as THREE.Mesh;
              if (candidate.isMesh && !seen.has(candidate)) {
                seen.add(candidate);
                meshes.push(candidate);
              }
            });
          });
          return meshes;
        }

        const wallMeshes = findWallMeshes();
        wallMeshes.forEach((wallMesh, index) => {
          const { vertices, indices } = buildTrimeshFromMesh(wallMesh);
          if (vertices.length === 0 || indices.length === 0) return;
          physics.addBody({
            id: `blender-wall-${index}-${wallMesh.name}`,
            position: { x: 0, y: 0, z: 0 },
            rotation: { x: 0, y: 0, z: 0 },
            isStatic: true,
            shape: "trimesh",
            vertices,
            indices,
            friction: 0.4,
            restitution: 0.15,
          });
        });

        if (wallMeshes.length > 0) {
          console.log(`✅ ${wallMeshes.length} mur(s) Blender ajoutés en physique (colliders exacts)`);
        } else {
          console.warn("⚠️ Aucun mur Blender trouvé (noms attendus : \"_wall_*\" / \"wall_*\")");
        }

        // Ici on gere les champignons ("Champignion_a", "Champignion_b") comme
        // obstacles : même principe que les murs (collider trimesh exact à
        // partir du vrai mesh Blender), pour que la balle roule/rebondisse
        // sur leur vraie forme (dôme) au lieu de traverser, et continue sa
        // trajectoire vers le bas si elle est juste posée dessus. Friction
        // basse (comme le sol) pour qu'elle ne "colle" pas en haut du dôme,
        // et une restitution modérée pour qu'un coup de flipper rebondisse
        // dessus de façon crédible plutôt que de coller ou de s'envoler.
        function findObstacleMeshes(namePattern: RegExp): THREE.Mesh[] {
          const meshes: THREE.Mesh[] = [];
          const seen = new Set<THREE.Object3D>();
          tableScene.traverse((obj) => {
            if (!obj.name || !namePattern.test(obj.name)) return;
            obj.traverse((descendant) => {
              const candidate = descendant as THREE.Mesh;
              if (candidate.isMesh && !seen.has(candidate)) {
                seen.add(candidate);
                meshes.push(candidate);
              }
            });
          });
          return meshes;
        }

        const mushroomMeshes = findObstacleMeshes(/champignion/i);
        mushroomMeshes.forEach((mushroomMesh, index) => {
          const { vertices, indices } = buildTrimeshFromMesh(mushroomMesh);
          if (vertices.length === 0 || indices.length === 0) return;
          physics.addBody({
            id: `blender-mushroom-${index}-${mushroomMesh.name}`,
            position: { x: 0, y: 0, z: 0 },
            rotation: { x: 0, y: 0, z: 0 },
            isStatic: true,
            shape: "trimesh",
            vertices,
            indices,
            friction: 0.2,
            restitution: 0.4,
          });
        });

        if (mushroomMeshes.length > 0) {
          console.log(`✅ ${mushroomMeshes.length} mesh(es) de champignon ajoutés en physique (colliders exacts)`);
        } else {
          console.warn('⚠️ Aucun champignon trouvé (noms attendus : "Champignion_a" / "Champignion_b")');
        }

        resolve({ bridges });
>>>>>>> Stashed changes
      },
      undefined,
      (error) => reject(error),
    );
  });
}
