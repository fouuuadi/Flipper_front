import * as THREE from "three";
import Stats from "stats.js";

// Créer la scène
const scene = new THREE.Scene();

// Créer la caméra
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);

camera.position.z = 5;

// Créer le renderer
const renderer = new THREE.WebGLRenderer({ antialias: true });

renderer.setSize(window.innerWidth, window.innerHeight);

document.body.appendChild(renderer.domElement);

// Stats FPS
const stats = new Stats();
stats.showPanel(0); // 0 = FPS
document.body.appendChild(stats.dom);

// Créer un cube simple (test)
const geometry = new THREE.BoxGeometry();
const material = new THREE.MeshBasicMaterial({ color: 0xff0000 });
const cube = new THREE.Mesh(geometry, material);

scene.add(cube);

// Boucle de rendu
function animate() {
  stats.begin();

  requestAnimationFrame(animate);

  cube.rotation.x += 0.01;
  cube.rotation.y += 0.01;

  renderer.render(scene, camera);

  stats.end();
}

animate();
