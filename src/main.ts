import * as THREE from "three";
import { SceneManager } from "@engine/SceneManager";
import { Playfield } from "@modules/playfield/Playfield";
import { RapierPhysicsAdapter } from "@physics/RapierPhysicsAdapter";
import viteLogo from "../public/vite.svg";
import typescriptLogo from "./typescript.svg";

document.querySelector<HTMLDivElement>('#app')!.innerHTML = `
  <div>
    <a href="https://vite.dev" target="_blank">
      <img src="${viteLogo}" class="logo" alt="Vite logo" />
    </a>
    <a href="https://www.typescriptlang.org/" target="_blank">
      <img src="${typescriptLogo}" class="logo vanilla" alt="TypeScript logo" />
    </a>
    <h1>Vite + TypeScript</h1>
    <div class="card">
      <button id="counter" type="button"></button>
    </div>
    <p class="read-the-docs">
      Click on the Vite and TypeScript logos to learn more
    </p>
  </div>
`

const sceneManager = new SceneManager();

// Eclairage temporaire — sera remplace par le module lighting (Issue 12)
const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
directionalLight.position.set(0, 10, 5);
sceneManager.scene.add(ambientLight, directionalLight);

const playfield = new Playfield();
playfield.addTo(sceneManager.scene);

// Positionner la camera pour voir la table en perspective
sceneManager.camera.position.set(0, 8, 10);
sceneManager.camera.lookAt(0, 0, 0);

// Monde physique
const physics = new RapierPhysicsAdapter();

async function initPhysics() {
  // Initialiser Rapier (attend le WASM)
  await physics.init();

  // Créer le monde physique
  physics.createPlayfield({ y: 0 });
  physics.createTestBall({ position: { x: 0, y: 1, z: 0 } });

  
  // Enregistrer le callback de simulation physique
  sceneManager.onUpdate((deltaTime) => {
    physics.step(deltaTime);
  });

  // Démarrer la render loop
  sceneManager.start();
}

// Lancer l'initialisation
initPhysics().catch((err) => {
  console.error("Erreur lors de l'initialisation de la physique :", err);
});