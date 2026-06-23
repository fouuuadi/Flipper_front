import fs from "fs";

const data = fs.readFileSync("public/models/tableMarioGalaxy.glb");
let offset = 12;
let json = null;
let bin = null;
while (offset < data.length) {
  const chunkLength = data.readUInt32LE(offset);
  const chunkType = data.readUInt32LE(offset + 4);
  const chunkData = data.subarray(offset + 8, offset + 8 + chunkLength);
  if (chunkType === 0x4e4f534a) {
    json = JSON.parse(chunkData.toString("utf8"));
  } else if (chunkType === 0x004e4942) {
    bin = chunkData;
  }
  offset += 8 + chunkLength;
}

const gltf = json;

function getAccessorData(accessorIndex) {
  const accessor = gltf.accessors[accessorIndex];
  const bufferView = gltf.bufferViews[accessor.bufferView];
  const byteOffset = (bufferView.byteOffset || 0) + (accessor.byteOffset || 0);
  const compMap = {
    5120: Int8Array, 5121: Uint8Array, 5122: Int16Array, 5123: Uint16Array,
    5125: Uint32Array, 5126: Float32Array,
  };
  const typeMap = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4, MAT4: 16 };
  const numComponents = typeMap[accessor.type];
  const Ctor = compMap[accessor.componentType];
  const count = accessor.count;
  const arr = new Ctor(bin.buffer, bin.byteOffset + byteOffset, count * numComponents);
  return { arr, numComponents, count };
}

function mat4Identity() {
  return [1,0,0,0, 0,1,0,0, 0,0,1,0, 0,0,0,1];
}
function mat4FromTRS(node) {
  if (node.matrix) return node.matrix;
  const t = node.translation || [0,0,0];
  const r = node.rotation || [0,0,0,1];
  const s = node.scale || [1,1,1];
  const [x,y,z,w] = r;
  const x2=x+x, y2=y+y, z2=z+z;
  const xx=x*x2, xy=x*y2, xz=x*z2;
  const yy=y*y2, yz=y*z2, zz=z*z2;
  const wx=w*x2, wy=w*y2, wz=w*z2;
  const m = [
    (1-(yy+zz))*s[0], (xy+wz)*s[0], (xz-wy)*s[0], 0,
    (xy-wz)*s[1], (1-(xx+zz))*s[1], (yz+wx)*s[1], 0,
    (xz+wy)*s[2], (yz-wx)*s[2], (1-(xx+yy))*s[2], 0,
    t[0], t[1], t[2], 1
  ];
  return m;
}
function mat4Multiply(a, b) {
  const out = new Array(16).fill(0);
  for (let col = 0; col < 4; col++) {
    for (let row = 0; row < 4; row++) {
      let sum = 0;
      for (let k = 0; k < 4; k++) {
        sum += a[k*4+row] * b[col*4+k];
      }
      out[col*4+row] = sum;
    }
  }
  return out;
}
function mat4TransformPoint(m, p) {
  const x = p[0], y = p[1], z = p[2];
  return [
    m[0]*x + m[4]*y + m[8]*z + m[12],
    m[1]*x + m[5]*y + m[9]*z + m[13],
    m[2]*x + m[6]*y + m[10]*z + m[14],
  ];
}

const scene = gltf.scenes[gltf.scene ?? 0];
const nodeWorld = new Map();

function visit(nodeIdx, parentMatrix) {
  const node = gltf.nodes[nodeIdx];
  const local = mat4FromTRS(node);
  const world = mat4Multiply(parentMatrix, local);
  nodeWorld.set(nodeIdx, world);
  if (node.children) {
    for (const c of node.children) visit(c, world);
  }
}
for (const rootIdx of scene.nodes) visit(rootIdx, mat4Identity());

const targetNames = ["Tunel_a", "Tunel_b", "Tunel_c", "Rampe", "Ramp_2", "Plane"];
const results = {};

for (const [nodeIdx, node] of gltf.nodes.entries()) {
  if (!targetNames.includes(node.name)) continue;
  if (node.mesh === undefined) continue;
  const mesh = gltf.meshes[node.mesh];
  const world = nodeWorld.get(nodeIdx);
  let min = [Infinity, Infinity, Infinity];
  let max = [-Infinity, -Infinity, -Infinity];
  for (const prim of mesh.primitives) {
    const posAccessorIdx = prim.attributes.POSITION;
    const { arr, numComponents, count } = getAccessorData(posAccessorIdx);
    for (let i = 0; i < count; i++) {
      const p = [arr[i*numComponents], arr[i*numComponents+1], arr[i*numComponents+2]];
      const wp = mat4TransformPoint(world, p);
      for (let k = 0; k < 3; k++) {
        if (wp[k] < min[k]) min[k] = wp[k];
        if (wp[k] > max[k]) max[k] = wp[k];
      }
    }
  }
  const center = [(min[0]+max[0])/2, (min[1]+max[1])/2, (min[2]+max[2])/2];
  const size = [max[0]-min[0], max[1]-min[1], max[2]-min[2]];
  results[node.name] = { min, max, center, size };
}

console.log(JSON.stringify(results, null, 2));
