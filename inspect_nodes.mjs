import fs from "fs";
const data = fs.readFileSync("public/models/tableMarioGalaxy.glb");
let offset = 12;
let json = null;
while (offset < data.length) {
  const chunkLength = data.readUInt32LE(offset);
  const chunkType = data.readUInt32LE(offset + 4);
  const chunkData = data.subarray(offset + 8, offset + 8 + chunkLength);
  if (chunkType === 0x4e4f534a) json = JSON.parse(chunkData.toString("utf8"));
  offset += 8 + chunkLength;
}
const gltf = json;

// find all nodes whose name includes "Tunel"
gltf.nodes.forEach((node, idx) => {
  if (node.name && node.name.includes("Tunel")) {
    console.log(idx, JSON.stringify({ name: node.name, mesh: node.mesh, children: node.children, translation: node.translation, scale: node.scale }));
  }
});

console.log("---meshes for Tunel_b/c---");
gltf.nodes.forEach((node) => {
  if (node.mesh !== undefined && (node.name === "Tunel_b" || node.name === "Tunel_c")) {
    const mesh = gltf.meshes[node.mesh];
    console.log(node.name, "mesh idx", node.mesh, "primitives:", mesh.primitives.length, "mesh name:", mesh.name);
  }
});

// also check parent relationships - find which nodes have a Tunel_b/c node as child
gltf.nodes.forEach((node, idx) => {
  if (node.children) {
    node.children.forEach((c) => {
      const child = gltf.nodes[c];
      if (child.name && child.name.includes("Tunel")) {
        console.log("parent of", child.name, "is node", idx, "name:", node.name);
      }
    });
  }
});
