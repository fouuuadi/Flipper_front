globalThis.self = globalThis;
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import fs from "fs";

global.THREE = THREE;

// Node doesn't have fetch-file-loading by default for GLTFLoader's internal use of FileLoader (it uses XHR/fetch).
// We'll use the Node-compatible approach: read file manually and parse via GLTFLoader.parse with ArrayBuffer.
const data = fs.readFileSync("public/models/tableMarioGalaxy.glb");
const arrayBuffer = data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength);

const loader = new GLTFLoader();
loader.parse(arrayBuffer, "", (gltf) => {
  const names = ["Tunel_a", "Tunel_b", "Tunel_c", "Rampe", "Ramp_2", "Plane"];
  gltf.scene.updateMatrixWorld(true);
  const results = {};
  gltf.scene.traverse((obj) => {
    if (names.includes(obj.name)) {
      const box = new THREE.Box3().setFromObject(obj);
      results[obj.name] = {
        min: box.min.toArray(),
        max: box.max.toArray(),
        center: box.getCenter(new THREE.Vector3()).toArray(),
        size: box.getSize(new THREE.Vector3()).toArray(),
      };
    }
  });
  console.log(JSON.stringify(results, null, 2));
}, (err) => {
  console.error("parse error", err);
});
