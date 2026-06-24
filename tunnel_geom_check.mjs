import fs from "fs";

const data = fs.readFileSync("public/models/tableMarioGalaxy.glb");
let offset = 12;
let json = null;
let bin = null;
while (offset < data.length) {
  const chunkLength = data.readUInt32LE(offset);
  const chunkType = data.readUInt32LE(offset + 4);
  const chunkData = data.subarray(offset + 8, offset + 8 + chunkLength);
  if (chunkType === 0x4e4f534a) json = JSON.parse(chunkData.toString("utf8"));
  else if (chunkType === 0x004e4942) bin = chunkData;
  offset += 8 + chunkLength;
}
const gltf = json;

function getPositions(accessorIndex) {
  const accessor = gltf.accessors[accessorIndex];
  const bufferView = gltf.bufferViews[accessor.bufferView];
  const compSize = { 5120:1,5121:1,5122:2,5123:2,5125:4,5126:4 }[accessor.componentType];
  const numComp = { SCALAR:1, VEC2:2, VEC3:3, VEC4:4 }[accessor.type];
  const elementSize = compSize * numComp;
  const stride = bufferView.byteStride || elementSize;
  const baseOffset = (bufferView.byteOffset||0) + (accessor.byteOffset||0);
  const out = [];
  for (let i=0;i<accessor.count;i++) {
    const o = baseOffset + i*stride;
    out.push([
      bin.readFloatLE(o),
      bin.readFloatLE(o+4),
      bin.readFloatLE(o+8),
    ]);
  }
  return out;
}

function mat4Identity(){return [1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1];}
function mat4FromTRS(node){
  if (node.matrix) return node.matrix;
  const t = node.translation||[0,0,0];
  const r = node.rotation||[0,0,0,1];
  const s = node.scale||[1,1,1];
  const [x,y,z,w]=r;
  const x2=x+x,y2=y+y,z2=z+z;
  const xx=x*x2,xy=x*y2,xz=x*z2,yy=y*y2,yz=y*z2,zz=z*z2,wx=w*x2,wy=w*y2,wz=w*z2;
  return [
    (1-(yy+zz))*s[0],(xy+wz)*s[0],(xz-wy)*s[0],0,
    (xy-wz)*s[1],(1-(xx+zz))*s[1],(yz+wx)*s[1],0,
    (xz+wy)*s[2],(yz-wx)*s[2],(1-(xx+yy))*s[2],0,
    t[0],t[1],t[2],1
  ];
}
function mat4Mul(a,b){
  const out=new Array(16).fill(0);
  for(let c=0;c<4;c++)for(let r=0;r<4;r++){let s=0;for(let k=0;k<4;k++)s+=a[k*4+r]*b[c*4+k];out[c*4+r]=s;}
  return out;
}
function mat4Pt(m,p){
  return [
    m[0]*p[0]+m[4]*p[1]+m[8]*p[2]+m[12],
    m[1]*p[0]+m[5]*p[1]+m[9]*p[2]+m[13],
    m[2]*p[0]+m[6]*p[1]+m[10]*p[2]+m[14],
  ];
}

// scene-level scale applied at runtime: gltf.scene.scale.setScalar(3)
const SCENE_SCALE = 3;

const scene = gltf.scenes[gltf.scene ?? 0];
const nodeWorld = new Map();
function visit(idx, parent){
  const node = gltf.nodes[idx];
  const world = mat4Mul(parent, mat4FromTRS(node));
  nodeWorld.set(idx, world);
  (node.children||[]).forEach(c=>visit(c, world));
}
scene.nodes.forEach(r=>visit(r, mat4Identity()));

const targets = ["Tunel_a","Tunel_b","Tunel_c","Rampe","Ramp_2","Plane"];
const results = {};
gltf.nodes.forEach((node, idx)=>{
  if (!targets.includes(node.name) || node.mesh===undefined) return;
  const mesh = gltf.meshes[node.mesh];
  const world = nodeWorld.get(idx);
  let min=[Infinity,Infinity,Infinity], max=[-Infinity,-Infinity,-Infinity];
  mesh.primitives.forEach(prim=>{
    const positions = getPositions(prim.attributes.POSITION);
    positions.forEach(p=>{
      const wp = mat4Pt(world, p).map(v=>v*SCENE_SCALE);
      for(let k=0;k<3;k++){ if(wp[k]<min[k])min[k]=wp[k]; if(wp[k]>max[k])max[k]=wp[k]; }
    });
  });
  results[node.name] = {
    min, max,
    center: [(min[0]+max[0])/2,(min[1]+max[1])/2,(min[2]+max[2])/2],
    size: [max[0]-min[0],max[1]-min[1],max[2]-min[2]],
  };
});

console.log(JSON.stringify(results, null, 2));

// Distance checks vs TUNNEL_TRIGGER_RADIUS=0.72
function dist2D(a,b){ return Math.hypot(a[0]-b[0], a[2]-b[2]); }
console.log("\n--- Distances XZ entre centres (échelle x3, unités réelles du jeu) ---");
["Tunel_b","Tunel_c"].forEach(t=>{
  ["Rampe","Ramp_2"].forEach(r=>{
    if (results[t] && results[r]) {
      console.log(t, "<->", r, ":", dist2D(results[t].center, results[r].center).toFixed(3));
    }
  });
});

// extra: wall_four, Rails_Metal_Security, Rails_Metal_Security_1
const extraTargets = ["wall_four","wall_three","wall_five","Rails_Metal_Security","Rails_Metal_Security_1","Rails_Ligne"];
const extraResults = {};
gltf.nodes.forEach((node, idx)=>{
  if (!extraTargets.includes(node.name) || node.mesh===undefined) return;
  const mesh = gltf.meshes[node.mesh];
  const world = nodeWorld.get(idx);
  let min=[Infinity,Infinity,Infinity], max=[-Infinity,-Infinity,-Infinity];
  mesh.primitives.forEach(prim=>{
    const positions = getPositions(prim.attributes.POSITION);
    positions.forEach(p=>{
      const wp = mat4Pt(world, p).map(v=>v*SCENE_SCALE);
      for(let k=0;k<3;k++){ if(wp[k]<min[k])min[k]=wp[k]; if(wp[k]>max[k])max[k]=wp[k]; }
    });
  });
  extraResults[node.name] = {
    min, max,
    center: [(min[0]+max[0])/2,(min[1]+max[1])/2,(min[2]+max[2])/2],
  };
});
console.log("\n--- Extra colliders ---");
console.log(JSON.stringify(extraResults, null, 2));
