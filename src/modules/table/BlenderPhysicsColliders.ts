import * as THREE from "three";
import RAPIER from "@dimforge/rapier3d-compat";

type ColliderKind = "floor" | "table" | "wall" | "rail" | "ramp" | "round" | "solid";

const MESH_COLLIDERS: Record<string, ColliderKind> = {
  Plane: "floor",
  Table: "table",
  wall_one: "wall",
  wall_two: "wall",
  wall_three: "wall",
  wall_four: "wall",
  wall_five: "wall",
  wall_six: "wall",
  Rails_Ligne: "rail",
  Rails_Metal_Security: "rail",
  Rails_Metal_Security_1: "rail",
  Rampe: "ramp",
  Ramp_2: "ramp",
  Slingshot_triangle: "solid",
  Book_left: "solid",
  Book_right: "solid",
  Browser: "solid",
  Bump: "round",
  Champignion_a: "round",
  Champignion_b: "round",
  Planet_Glace: "round",
  Planet_Terre: "round",
  Planet_Volcan: "round",
  Tunel_a: "solid",
  Tunel_b: "solid",
  Tunel_c: "solid",
  Ligne: "solid",
  "Canon.001": "solid",
  "Object_2.002": "solid",
  Object_3: "solid",
  Object_4: "solid",
  cube_1: "wall",
  Cube_2: "wall",
  Cube_3: "wall",
  Cube_4: "wall",
  Cube_5: "wall",
};

const BOX_COLLIDERS = new Set([
  "wall_one",
  "wall_two",
  "wall_three",
  "wall_four",
  "wall_five",
  "cube_1",
  "Cube_2",
  "Cube_3",
  "Cube_4",
  "Cube_5",
]);
const EXPECTED_BOX_WALLS = ["wall_one", "wall_two", "wall_three", "wall_four", "wall_five"];
const TRIMESH_COLLIDERS = new Set(["Tunel_a", "Tunel_b", "Tunel_c"]);
const MIN_BOX_SIZE = 0.12;
const BOX_SIZE_OVERRIDES: Partial<Record<string, Partial<Record<"x" | "y" | "z", number>>>> = {
  wall_two: { x: 0.42 },
};
const BOX_SIZE_EXPANSIONS: Partial<Record<string, Partial<Record<"x" | "y" | "z", number>>>> = {
  wall_one: { z: 1.1 },
};
const BOX_POSITION_OFFSETS: Partial<Record<string, Partial<Record<"x" | "y" | "z", number>>>> = {
  wall_one: { z: 0.45 },
  wall_two: { x: -1.0 },
};

export interface NamedPhysicsCollider {
  collider: RAPIER.Collider;
  /** Centre (AABB) du collider, en coordonnées monde, utile pour calculer une direction de répulsion. */
  center: THREE.Vector3;
}

/** Noms de colliders dont on a besoin de garder une référence après coup (ex. Slingshot actif). */
const TRACKED_COLLIDERS = new Set([
  "Slingshot_triangle",
  "Planet_Glace",
  "Planet_Terre",
  "Planet_Volcan",
  "Rampe",
  "Ramp_2",
  "Champignion_a",
  "Champignion_b",
  "Bump",
  "Tunel_b",
  "Tunel_c",
  "Ligne",
]);

export function createBlenderPhysicsColliders(
  root: THREE.Object3D,
  world: RAPIER.World,
  scene?: THREE.Scene,
): Record<string, NamedPhysicsCollider> {
  root.updateWorldMatrix(true, true);
  const createdBoxWalls = new Set<string>();
  const namedColliders: Record<string, NamedPhysicsCollider> = {};

  root.traverse((object) => {
    const rawName = object.name;
    const colliderName = normalizeColliderName(object.name);
    const kind = MESH_COLLIDERS[colliderName] ?? inferColliderKind(rawName, colliderName);
    if (import.meta.env.DEV && hasWallName(rawName, colliderName)) {
      console.info("[BlenderPhysicsColliders] wall candidate", {
        rawName,
        normalizedName: colliderName,
        isMesh: object instanceof THREE.Mesh,
        mappedKind: kind ?? null,
      });
    }
    if (!kind) return;

    if (usesBoxCollider(rawName, colliderName)) {
      createdBoxWalls.add(colliderName);

      const boxCollider = createBoxColliderFromObject(object, colliderName);
      if (!boxCollider) return;

      const body = world.createRigidBody(RAPIER.RigidBodyDesc.fixed());
      world.createCollider(boxCollider.collider, body);

      if (scene) {
        scene.add(boxCollider.helper);
      }
      return;
    }

    // Certains noeuds Blender (ex. Champignion_a/b) ont plusieurs primitives/matériaux :
    // le GLTFLoader les charge alors comme un Group contenant plusieurs Mesh enfants
    // au lieu d'un Mesh unique. On fusionne toutes les géométries du sous-arbre pour
    // créer un seul collider couvrant l'objet entier (sinon il reste traversable).
    const meshes = object instanceof THREE.Mesh ? [object] : collectMeshes(object);
    if (meshes.length === 0) return;

    const geometry = extractWorldGeometryFromMeshes(meshes);
    if (!geometry) return;

    const collider =
      (kind === "round" || kind === "solid") && !TRIMESH_COLLIDERS.has(colliderName)
        ? createConvexCollider(geometry, colliderName)
        : createTriMeshCollider(geometry, colliderName);

    if (!collider) return;

    const body = world.createRigidBody(RAPIER.RigidBodyDesc.fixed());
    const createdCollider = world.createCollider(collider, body);

    if (TRACKED_COLLIDERS.has(colliderName)) {
      // Le slingshot a besoin d'événements de collision actifs (pas juste de
      // la restitution passive) pour déclencher son impulsion réactive.
      createdCollider.setActiveEvents(RAPIER.ActiveEvents.COLLISION_EVENTS);

      geometry.helperGeometry.computeBoundingBox();
      const box = geometry.helperGeometry.boundingBox;
      const center = box ? box.getCenter(new THREE.Vector3()) : new THREE.Vector3();

      namedColliders[colliderName] = { collider: createdCollider, center };
    }

    if (scene) {
      scene.add(createGeometryHelper(geometry, helperColor(kind), colliderName));
    }
  });

  for (const wallName of EXPECTED_BOX_WALLS) {
    if (createdBoxWalls.has(wallName)) continue;

    const wallObject = findWallObject(root, wallName);
    if (!wallObject) {
      if (import.meta.env.DEV) {
        console.warn("[BlenderPhysicsColliders] missing expected wall", wallName);
      }
      continue;
    }

    const fallback = createBoxColliderFromObject(wallObject, wallName);
    if (!fallback) continue;

    const body = world.createRigidBody(RAPIER.RigidBodyDesc.fixed());
    world.createCollider(fallback.collider, body);

    if (scene) {
      scene.add(fallback.helper);
    }

    if (import.meta.env.DEV) {
      console.warn("[BlenderPhysicsColliders] fallback AABB wall collider", wallName, {
        rawName: wallObject.name,
      });
    }
  }

  if (import.meta.env.DEV) {
    for (const trackedName of TRACKED_COLLIDERS) {
      if (!namedColliders[trackedName]) {
        console.warn("[BlenderPhysicsColliders] tracked collider introuvable", trackedName);
      }
    }
  }

  return namedColliders;
}

function normalizeColliderName(name: string): string {
  const compactName = stripInvisibleNameCharacters(name.normalize("NFKC")).trim();

  return compactName.replace(/^_+(wall_)/i, "$1");
}

function stripInvisibleNameCharacters(name: string): string {
  return Array.from(name, (character) => {
    const code = character.codePointAt(0) ?? 0;
    const isInvisible =
      code <= 0x20 ||
      (code >= 0x7f && code <= 0xa0) ||
      code === 0x1680 ||
      code === 0x180e ||
      (code >= 0x2000 && code <= 0x200b) ||
      code === 0x2028 ||
      code === 0x2029 ||
      code === 0x202f ||
      code === 0x205f ||
      code === 0x3000 ||
      code === 0xfeff;
    return isInvisible ? "" : character;
  }).join("");
}

function inferColliderKind(rawName: string, normalizedName: string): ColliderKind | undefined {
  return hasWallName(rawName, normalizedName) ? "wall" : undefined;
}

function usesBoxCollider(rawName: string, normalizedName: string): boolean {
  if (BOX_COLLIDERS.has(normalizedName)) return true;
  if (!hasWallName(rawName, normalizedName)) return false;

  return normalizeColliderName(rawName).toLowerCase() !== "wall_six";
}

function findWallObject(root: THREE.Object3D, expectedName: string): THREE.Object3D | null {
  let found: THREE.Object3D | null = null;

  root.traverse((object) => {
    if (found) return;
    const normalizedName = normalizeColliderName(object.name).toLowerCase();
    const rawName = object.name.toLowerCase();
    if (normalizedName === expectedName || rawName.trim() === expectedName) {
      found = object;
    }
  });

  return found;
}

function hasWallName(rawName: string, normalizedName: string): boolean {
  const compactRawName = normalizeColliderName(rawName).toLowerCase();
  const compactNormalizedName = normalizedName.toLowerCase();

  return (
    compactRawName.startsWith("wall_") ||
    compactNormalizedName.startsWith("wall_") ||
    rawName.toLowerCase().includes("wall_")
  );
}

function createAabbCollider(
  object: THREE.Object3D,
  name: string,
): { collider: RAPIER.ColliderDesc; helper: THREE.Group } | null {
  const box = new THREE.Box3().setFromObject(object);
  if (box.isEmpty()) return null;

  const center = box.getCenter(new THREE.Vector3());
  const size = box.getSize(new THREE.Vector3());
  size.set(
    Math.max(size.x, MIN_BOX_SIZE),
    Math.max(size.y, MIN_BOX_SIZE),
    Math.max(size.z, MIN_BOX_SIZE),
  );

  const collider = RAPIER.ColliderDesc.cuboid(size.x / 2, size.y / 2, size.z / 2)
    .setTranslation(center.x, center.y, center.z)
    .setFriction(0.35)
    .setRestitution(restitutionFor(name));

  const helper = createAabbHelper(size, center, name);

  return { collider, helper };
}

function createBoxColliderFromObject(
  object: THREE.Object3D,
  name: string,
): { collider: RAPIER.ColliderDesc; helper: THREE.Group } | null {
  const mesh = object instanceof THREE.Mesh ? object : findBestColliderMesh(object, name);
  if (!mesh) return createAabbCollider(object, name);

  return createBoxCollider(mesh, name);
}

function findBestColliderMesh(object: THREE.Object3D, expectedName: string): THREE.Mesh | null {
  let namedMesh: THREE.Mesh | null = null;
  let largestMesh: THREE.Mesh | null = null;
  let largestVolume = 0;

  object.traverse((child) => {
    if (!(child instanceof THREE.Mesh)) return;

    child.geometry.computeBoundingBox();
    const box = child.geometry.boundingBox;
    if (!box) return;

    const size = box.getSize(new THREE.Vector3());
    const volume = size.x * size.y * size.z;
    if (normalizeColliderName(child.name).toLowerCase() === expectedName) {
      namedMesh = child;
    }

    if (volume > largestVolume) {
      largestVolume = volume;
      largestMesh = child;
    }
  });

  return namedMesh ?? largestMesh;
}

function createBoxCollider(
  mesh: THREE.Mesh,
  name: string,
): { collider: RAPIER.ColliderDesc; helper: THREE.Group } | null {
  mesh.geometry.computeBoundingBox();
  const box = mesh.geometry.boundingBox;
  if (!box) return null;

  const localCenter = box.getCenter(new THREE.Vector3());
  const localSize = box.getSize(new THREE.Vector3());
  const worldCenter = localCenter.applyMatrix4(mesh.matrixWorld);
  const worldScale = new THREE.Vector3();
  const worldRotation = new THREE.Quaternion();
  const worldPosition = new THREE.Vector3();
  mesh.matrixWorld.decompose(worldPosition, worldRotation, worldScale);

  const size = new THREE.Vector3(
    Math.max(Math.abs(localSize.x * worldScale.x), MIN_BOX_SIZE),
    Math.max(Math.abs(localSize.y * worldScale.y), MIN_BOX_SIZE),
    Math.max(Math.abs(localSize.z * worldScale.z), MIN_BOX_SIZE),
  );
  applyBoxSizeExpansion(size, name);
  applyBoxSizeOverride(size, name);
  applyBoxPositionOffset(worldCenter, name);

  const collider = RAPIER.ColliderDesc.cuboid(size.x / 2, size.y / 2, size.z / 2)
    .setTranslation(worldCenter.x, worldCenter.y, worldCenter.z)
    .setRotation({
      x: worldRotation.x,
      y: worldRotation.y,
      z: worldRotation.z,
      w: worldRotation.w,
    })
    .setFriction(0.35)
    .setRestitution(restitutionFor(name));

  const helper = createBoxHelper(size, worldCenter, worldRotation, helperColor("wall"), name);

  return { collider, helper };
}

function applyBoxSizeExpansion(size: THREE.Vector3, name: string): void {
  const expansion = BOX_SIZE_EXPANSIONS[name];
  if (!expansion) return;

  size.add(new THREE.Vector3(expansion.x ?? 0, expansion.y ?? 0, expansion.z ?? 0));
}

function applyBoxSizeOverride(size: THREE.Vector3, name: string): void {
  const override = BOX_SIZE_OVERRIDES[name];
  if (!override) return;

  if (typeof override.x === "number") size.x = override.x;
  if (typeof override.y === "number") size.y = override.y;
  if (typeof override.z === "number") size.z = override.z;
}

function applyBoxPositionOffset(position: THREE.Vector3, name: string): void {
  const offset = BOX_POSITION_OFFSETS[name];
  if (!offset) return;

  position.add(new THREE.Vector3(offset.x ?? 0, offset.y ?? 0, offset.z ?? 0));
}

function extractWorldGeometry(mesh: THREE.Mesh): {
  vertices: Float32Array;
  indices: Uint32Array;
  helperGeometry: THREE.BufferGeometry;
} | null {
  const position = mesh.geometry.getAttribute("position");
  if (!position || position.count < 3) return null;

  const vertices = new Float32Array(position.count * 3);
  const vertex = new THREE.Vector3();

  for (let i = 0; i < position.count; i += 1) {
    vertex.fromBufferAttribute(position, i).applyMatrix4(mesh.matrixWorld);
    vertices[i * 3] = vertex.x;
    vertices[i * 3 + 1] = vertex.y;
    vertices[i * 3 + 2] = vertex.z;
  }

  const indices = mesh.geometry.index
    ? copyIndex(mesh.geometry.index)
    : createSequentialIndices(position.count);

  const helperGeometry = new THREE.BufferGeometry();
  helperGeometry.setAttribute("position", new THREE.BufferAttribute(vertices.slice(), 3));
  helperGeometry.setIndex(new THREE.BufferAttribute(indices.slice(), 1));

  return { vertices, indices, helperGeometry };
}

function collectMeshes(object: THREE.Object3D): THREE.Mesh[] {
  const meshes: THREE.Mesh[] = [];
  object.traverse((child) => {
    if (child instanceof THREE.Mesh) meshes.push(child);
  });
  return meshes;
}

function extractWorldGeometryFromMeshes(meshes: THREE.Mesh[]): {
  vertices: Float32Array;
  indices: Uint32Array;
  helperGeometry: THREE.BufferGeometry;
} | null {
  const vertexChunks: Float32Array[] = [];
  const indexChunks: Uint32Array[] = [];
  let vertexOffset = 0;

  for (const mesh of meshes) {
    const geometry = extractWorldGeometry(mesh);
    if (!geometry) continue;

    vertexChunks.push(geometry.vertices);

    const offsetIndices = new Uint32Array(geometry.indices.length);
    for (let i = 0; i < geometry.indices.length; i += 1) {
      offsetIndices[i] = geometry.indices[i] + vertexOffset;
    }
    indexChunks.push(offsetIndices);

    vertexOffset += geometry.vertices.length / 3;
  }

  const totalVertexLength = vertexChunks.reduce((sum, chunk) => sum + chunk.length, 0);
  if (totalVertexLength < 9) return null;

  const vertices = new Float32Array(totalVertexLength);
  let vertexCursor = 0;
  for (const chunk of vertexChunks) {
    vertices.set(chunk, vertexCursor);
    vertexCursor += chunk.length;
  }

  const totalIndexLength = indexChunks.reduce((sum, chunk) => sum + chunk.length, 0);
  const indices = new Uint32Array(totalIndexLength);
  let indexCursor = 0;
  for (const chunk of indexChunks) {
    indices.set(chunk, indexCursor);
    indexCursor += chunk.length;
  }

  const helperGeometry = new THREE.BufferGeometry();
  helperGeometry.setAttribute("position", new THREE.BufferAttribute(vertices.slice(), 3));
  helperGeometry.setIndex(new THREE.BufferAttribute(indices.slice(), 1));

  return { vertices, indices, helperGeometry };
}

function createTriMeshCollider(
  geometry: { vertices: Float32Array; indices: Uint32Array },
  name: string,
): RAPIER.ColliderDesc | null {
  return RAPIER.ColliderDesc.trimesh(geometry.vertices, makeDoubleSidedIndices(geometry.indices))
    .setFriction(frictionFor(name))
    .setRestitution(restitutionFor(name));
}

function createConvexCollider(
  geometry: { vertices: Float32Array },
  name: string,
): RAPIER.ColliderDesc | null {
  const collider =
    RAPIER.ColliderDesc.roundConvexHull(geometry.vertices, 0.04) ??
    RAPIER.ColliderDesc.convexHull(geometry.vertices);

  return collider?.setFriction(0.35).setRestitution(restitutionFor(name)) ?? null;
}

function createGeometryHelper(
  geometry: { helperGeometry: THREE.BufferGeometry },
  color: number,
  name: string,
): THREE.Group {
  const group = new THREE.Group();
  group.name = `physics-collider:${name}`;

  const surface = new THREE.Mesh(
    geometry.helperGeometry,
    new THREE.MeshBasicMaterial({
      color,
      wireframe: true,
      transparent: true,
      opacity: 0.82,
      depthTest: false,
      depthWrite: false,
    }),
  );
  surface.name = `physics-collider:${name}:wire`;
  surface.renderOrder = 998;
  group.add(surface);

  const edges = new THREE.LineSegments(
    new THREE.EdgesGeometry(geometry.helperGeometry),
    new THREE.LineBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.95,
      depthTest: false,
      depthWrite: false,
    }),
  );
  edges.name = `physics-collider:${name}:edges`;
  edges.renderOrder = 999;
  group.add(edges);

  geometry.helperGeometry.computeBoundingBox();
  const box = geometry.helperGeometry.boundingBox;
  if (box) {
    const center = box.getCenter(new THREE.Vector3());
    const size = box.getSize(new THREE.Vector3());
    group.add(createDebugLabel(name, center, Math.max(size.x, size.y, size.z)));
  }

  return group;
}

function createBoxHelper(
  size: THREE.Vector3,
  center: THREE.Vector3,
  rotation: THREE.Quaternion,
  color: number,
  name: string,
): THREE.Group {
  const group = new THREE.Group();
  group.name = `physics-collider:${name}`;
  group.position.copy(center);
  group.quaternion.copy(rotation);

  const geometry = new THREE.BoxGeometry(size.x, size.y, size.z);
  const volume = new THREE.Mesh(
    geometry,
    new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity: 0.28,
      depthTest: false,
      depthWrite: false,
    }),
  );
  volume.name = `physics-collider:${name}:volume`;
  volume.renderOrder = 998;
  group.add(volume);

  const edges = new THREE.LineSegments(
    new THREE.EdgesGeometry(geometry),
    new THREE.LineBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 1,
      depthTest: false,
      depthWrite: false,
    }),
  );
  edges.name = `physics-collider:${name}:edges`;
  edges.renderOrder = 999;
  group.add(edges);

  const labelPosition = new THREE.Vector3(0, size.y / 2 + 0.22, 0);
  group.add(createDebugLabel(name, labelPosition, Math.max(size.x, size.y, size.z)));

  return group;
}

function createAabbHelper(size: THREE.Vector3, center: THREE.Vector3, name: string): THREE.Group {
  const group = new THREE.Group();
  group.name = `physics-fallback-aabb:${name}`;
  group.position.copy(center);

  const geometry = new THREE.BoxGeometry(size.x, size.y, size.z);
  const volume = new THREE.Mesh(
    geometry,
    new THREE.MeshBasicMaterial({
      color: 0xffd000,
      transparent: true,
      opacity: 0.22,
      depthTest: false,
      depthWrite: false,
    }),
  );
  volume.name = `physics-fallback-aabb:${name}:volume`;
  volume.renderOrder = 1003;
  group.add(volume);

  const edges = new THREE.LineSegments(
    new THREE.EdgesGeometry(geometry),
    new THREE.LineBasicMaterial({
      color: 0xffd000,
      transparent: true,
      opacity: 1,
      depthTest: false,
      depthWrite: false,
    }),
  );
  edges.name = `physics-fallback-aabb:${name}:edges`;
  edges.renderOrder = 1004;
  group.add(edges);

  const labelPosition = new THREE.Vector3(0, size.y / 2 + 0.62, 0);
  group.add(createDebugLabel(`FALLBACK ${name}`, labelPosition, Math.max(size.x, size.y, size.z)));

  return group;
}

function createDebugLabel(
  text: string,
  position: THREE.Vector3,
  referenceSize: number,
): THREE.Sprite {
  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d");
  if (!context) {
    const emptyMaterial = new THREE.SpriteMaterial({ transparent: true, opacity: 0 });
    const emptySprite = new THREE.Sprite(emptyMaterial);
    emptySprite.position.copy(position);
    return emptySprite;
  }

  const fontSize = 28;
  context.font = `700 ${fontSize}px sans-serif`;
  const textWidth = Math.ceil(context.measureText(text).width);
  canvas.width = Math.max(128, textWidth + 28);
  canvas.height = 48;

  context.font = `700 ${fontSize}px sans-serif`;
  context.fillStyle = "rgba(0, 0, 0, 0.72)";
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.strokeStyle = "rgba(255, 255, 255, 0.92)";
  context.lineWidth = 3;
  context.strokeRect(1.5, 1.5, canvas.width - 3, canvas.height - 3);
  context.fillStyle = "#ffffff";
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.fillText(text, canvas.width / 2, canvas.height / 2);

  const texture = new THREE.CanvasTexture(canvas);
  const material = new THREE.SpriteMaterial({
    map: texture,
    transparent: true,
    depthTest: false,
    depthWrite: false,
  });
  const sprite = new THREE.Sprite(material);
  const scale = Math.max(0.34, Math.min(referenceSize * 0.16, 0.9));
  sprite.position.copy(position);
  sprite.scale.set(scale * (canvas.width / canvas.height), scale, 1);
  sprite.name = `physics-collider-label:${text}`;
  sprite.renderOrder = 1000;

  return sprite;
}

function copyIndex(index: THREE.BufferAttribute | THREE.InterleavedBufferAttribute): Uint32Array {
  const indices = new Uint32Array(index.count);
  for (let i = 0; i < index.count; i += 1) {
    indices[i] = index.getX(i);
  }
  return indices;
}

function createSequentialIndices(count: number): Uint32Array {
  const indices = new Uint32Array(count);
  for (let i = 0; i < count; i += 1) {
    indices[i] = i;
  }
  return indices;
}

function makeDoubleSidedIndices(indices: Uint32Array): Uint32Array {
  const doubled = new Uint32Array(indices.length * 2);
  doubled.set(indices, 0);

  for (let i = 0; i + 2 < indices.length; i += 3) {
    const target = indices.length + i;
    doubled[target] = indices[i];
    doubled[target + 1] = indices[i + 2];
    doubled[target + 2] = indices[i + 1];
  }

  return doubled;
}

function restitutionFor(name: string): number {
  if (name === "Bump") return 0.28;
  if (name.startsWith("Champignion_")) return 0.35;
  if (name.startsWith("Planet_")) return 0.3;
  if (name === "Rampe" || name === "Ramp_2") return 0.0;
  if (name === "Plane") return 0.08;
  return 0.3;
}

function frictionFor(name: string): number {
  if (name === "Plane") return 0.55;
  if (name === "Rampe" || name === "Ramp_2") return 0.08;
  return 0.42;
}

function helperColor(kind: ColliderKind): number {
  switch (kind) {
    case "floor":
      return 0x00b7ff;
    case "wall":
      return 0xff40ff;
    case "table":
      return 0x00ff7f;
    case "rail":
      return 0xfff000;
    case "ramp":
      return 0xff7a00;
    case "round":
      return 0xff4040;
    case "solid":
      return 0xff40ff;
  }
}
