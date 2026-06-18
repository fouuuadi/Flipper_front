import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { BlenderFlipperBridge } from "./BlenderFlipperBridge";
import type { Flipper } from "@modules/flipper/Flipper";
import type { RapierPhysicsAdapter } from "@physics/RapierPhysicsAdapter";

export interface BlenderTableResult {
  bridges: BlenderFlipperBridge[];
}

/**
 * Ici on construit un collider trimesh à partir de la géométrie réelle d'un mesh,
 * en bakant sa matrice monde (position/rotation/scale + celles de tous ses
 * parents) directement dans les sommets. Le rigid body peut donc rester à
 * {0,0,0}/identité : le collider est déjà exprimé en repère monde
 * quelle que soit la hiérarchie GLB, et insensible aux futures modifications
 * de la table sous Blender (plus besoin de recopier des coordonnées à la main).
 */
function buildTrimeshFromMesh(mesh: THREE.Mesh): { vertices: Float32Array; indices: Uint32Array } {
  mesh.updateWorldMatrix(true, false);

  const geometry = mesh.geometry.clone();
  geometry.applyMatrix4(mesh.matrixWorld);

  const positionAttr = geometry.getAttribute("position");
  const vertices = new Float32Array(positionAttr.array.length);
  vertices.set(positionAttr.array as ArrayLike<number>);

  let indices: Uint32Array;
  if (geometry.index) {
    indices = new Uint32Array(geometry.index.array.length);
    indices.set(geometry.index.array as ArrayLike<number>);
  } else {
    // ici on génère un index séquentiel trivial.
    const vertexCount = positionAttr.count;
    indices = new Uint32Array(vertexCount);
    for (let i = 0; i < vertexCount; i++) indices[i] = i;
  }

  geometry.dispose();
  return { vertices, indices };
}

/**
 * Ici on charge la table modélisée sous Blender (GLB) dans la scène, on branche un
 * bridge par flipper trouvé dans la hiérarchie GLB comme (Flipper_left /
 * Flipper_right) pour synchroniser leur visuel sur les flippers physiques,
 * et remplace le sol physique approximatif par un collider trimesh
 */
export function loadBlenderTable(
  scene: THREE.Scene,
  leftFlipper: Flipper,
  rightFlipper: Flipper,
  physics: RapierPhysicsAdapter,
): Promise<BlenderTableResult> {
  return new Promise((resolve, reject) => {
    const loader = new GLTFLoader();

    loader.load(
      "/models/tableMarioGalaxy.glb",
      (gltf) => {
        const tableScene = gltf.scene;
        scene.add(tableScene);

        console.log("✅ Table Blender chargée");
        tableScene.traverse((obj) => {
          if (obj.name) {
            console.log(
              `   ▸ "${obj.name}" [${obj.type}]  pos=${obj.position.toArray().map((v) => +v.toFixed(2))}  scale=${obj.scale.toArray().map((v) => +v.toFixed(3))}`,
            );
          }
        });

        function findFlipper(side: "left" | "right"): THREE.Object3D | null {
          const exactName = side === "left" ? "Flipper_left" : "Flipper_right";
          const exact = tableScene.getObjectByName(exactName);
          if (exact) return exact;

          const frenchKeyword = side === "left" ? "gauche" : "droit";
          let fallback: THREE.Object3D | null = null;
          tableScene.traverse((obj) => {
            if (fallback || !obj.name) return;
            const lower = obj.name.toLowerCase();
            const hasFlipperWord = lower.includes("flipper");
            const hasSideWord = lower.includes(side) || lower.includes(frenchKeyword);
            if (hasFlipperWord && hasSideWord) fallback = obj;
          });
          if (fallback) {
            console.log(`🔎 Flipper "${side}" trouvé via recherche tolérante : "${fallback.name}"`);
          }
          return fallback;
        }

        const flipperLeftMesh = findFlipper("left");
        const flipperRightMesh = findFlipper("right");

        if (!flipperLeftMesh) console.warn("⚠️ Flipper_left introuvable dans le GLB (même en recherche tolérante)");
        if (!flipperRightMesh) console.warn("⚠️ Flipper_right introuvable dans le GLB (même en recherche tolérante)");

        for (const mesh of [flipperLeftMesh, flipperRightMesh]) {
          if (mesh && mesh.scale.lengthSq() === 0) {
            mesh.scale.set(1, 1, 1);
            console.log(`🔧 "${mesh.name}" scale forcé à (1,1,1)`);
          }
        }

        const bridges: BlenderFlipperBridge[] = [];
        if (flipperLeftMesh) {
          bridges.push(new BlenderFlipperBridge(leftFlipper, flipperLeftMesh));
          console.log("🔗 Bridge gauche prêt");
        }
        if (flipperRightMesh) {
          bridges.push(new BlenderFlipperBridge(rightFlipper, flipperRightMesh));
          console.log("🔗 Bridge droit prêt");
        }

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

        resolve({ bridges });
      },
      undefined,
      (error) => {
        console.error("❌ Erreur GLB :", error);
        reject(error);
      },
    );
  });
}
