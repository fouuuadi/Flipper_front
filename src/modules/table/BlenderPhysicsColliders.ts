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
};

export function createBlenderPhysicsColliders(
  root: THREE.Object3D,
  world: RAPIER.World,
  scene?: THREE.Scene,
): void {
  root.updateWorldMatrix(true, true);

  root.traverse((object) => {
    const colliderName = object.name.trim();
    const kind = MESH_COLLIDERS[colliderName];
    if (!kind || !(object instanceof THREE.Mesh)) return;

    const geometry = extractWorldGeometry(object);
    if (!geometry) return;

    const collider =
      kind === "round" || kind === "wall" || kind === "solid"
        ? createConvexCollider(geometry, colliderName)
        : createTriMeshCollider(geometry, colliderName);

    if (!collider) return;

    const body = world.createRigidBody(RAPIER.RigidBodyDesc.fixed());
    world.createCollider(collider, body);

    if (scene) {
      scene.add(createGeometryHelper(geometry, helperColor(kind)));
    }
  });
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

function createTriMeshCollider(
  geometry: { vertices: Float32Array; indices: Uint32Array },
  name: string,
): RAPIER.ColliderDesc | null {
  return RAPIER.ColliderDesc.trimesh(geometry.vertices, makeDoubleSidedIndices(geometry.indices))
    .setFriction(name === "Plane" ? 0.55 : 0.42)
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
): THREE.Mesh {
  const helper = new THREE.Mesh(
    geometry.helperGeometry,
    new THREE.MeshBasicMaterial({
      color,
      wireframe: true,
      transparent: true,
      opacity: 0.82,
      depthTest: false,
    }),
  );
  helper.renderOrder = 998;
  return helper;
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
  if (name === "Bump" || name.startsWith("Champignion_")) return 0.9;
  if (name.startsWith("Planet_")) return 0.5;
  if (name === "Plane") return 0.08;
  return 0.3;
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
