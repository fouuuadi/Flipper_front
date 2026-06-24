import fs from "fs";
const data = fs.readFileSync("public/models/tableMarioGalaxy.glb");
let offset=12, json=null, bin=null;
while(offset<data.length){
  const len=data.readUInt32LE(offset), type=data.readUInt32LE(offset+4);
  const chunk=data.subarray(offset+8,offset+8+len);
  if(type===0x4e4f534a) json=JSON.parse(chunk.toString('utf8'));
  else if(type===0x004e4942) bin=chunk;
  offset+=8+len;
}
const gltf=json;
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
    out.push([bin.readFloatLE(o), bin.readFloatLE(o+4), bin.readFloatLE(o+8)]);
  }
  return out;
}
function mat4FromTRS(node){
  if (node.matrix) return node.matrix;
  const t=node.translation||[0,0,0], r=node.rotation||[0,0,0,1], s=node.scale||[1,1,1];
  const [x,y,z,w]=r, x2=x+x,y2=y+y,z2=z+z;
  const xx=x*x2,xy=x*y2,xz=x*z2,yy=y*y2,yz=y*z2,zz=z*z2,wx=w*x2,wy=w*y2,wz=w*z2;
  return [(1-(yy+zz))*s[0],(xy+wz)*s[0],(xz-wy)*s[0],0,(xy-wz)*s[1],(1-(xx+zz))*s[1],(yz+wx)*s[1],0,(xz+wy)*s[2],(yz-wx)*s[2],(1-(xx+yy))*s[2],0,t[0],t[1],t[2],1];
}
function mat4Mul(a,b){const out=new Array(16).fill(0);for(let c=0;c<4;c++)for(let r=0;r<4;r++){let s=0;for(let k=0;k<4;k++)s+=a[k*4+r]*b[c*4+k];out[c*4+r]=s;}return out;}
function mat4Identity(){return [1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1];}
const scene = gltf.scenes[gltf.scene??0];
const nodeWorld = new Map();
function visit(idx,parent){ const node=gltf.nodes[idx]; const world=mat4Mul(parent, mat4FromTRS(node)); nodeWorld.set(idx,world); (node.children||[]).forEach(c=>visit(c,world)); }
scene.nodes.forEach(r=>visit(r, mat4Identity()));

gltf.nodes.forEach((node, idx)=>{
  const trimmed = (node.name||"").trim().replace(/^0\s*/,"");
  if (trimmed !== "wall_one" || node.mesh===undefined) return;
  const mesh = gltf.meshes[node.mesh];
  const world = nodeWorld.get(idx);
  // decompose world scale (assume no shear): length of each basis column
  const sx = Math.hypot(world[0],world[1],world[2]);
  const sy = Math.hypot(world[4],world[5],world[6]);
  const sz = Math.hypot(world[8],world[9],world[10]);
  console.log("node", idx, "name raw:", JSON.stringify(node.name), "worldScale:", [sx,sy,sz].map(v=>v.toFixed(4)));
  console.log("translation:", node.translation, "rotation:", node.rotation, "scale:", node.scale);
  let min=[Infinity,Infinity,Infinity], max=[-Infinity,-Infinity,-Infinity];
  mesh.primitives.forEach(prim=>{
    getPositions(prim.attributes.POSITION).forEach(p=>{
      for(let k=0;k<3;k++){ if(p[k]<min[k])min[k]=p[k]; if(p[k]>max[k])max[k]=p[k]; }
    });
  });
  console.log("local bbox min:", min.map(v=>v.toFixed(4)), "max:", max.map(v=>v.toFixed(4)));
  const localSize = [max[0]-min[0], max[1]-min[1], max[2]-min[2]];
  console.log("local size:", localSize.map(v=>v.toFixed(4)));
  console.log("local size * worldScale (no scene x3):", [localSize[0]*sx, localSize[1]*sy, localSize[2]*sz].map(v=>v.toFixed(4)));
  console.log("local size * worldScale * 3 (scene scale):", [localSize[0]*sx*3, localSize[1]*sy*3, localSize[2]*sz*3].map(v=>v.toFixed(4)));
});
