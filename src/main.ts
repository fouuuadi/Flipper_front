import * as THREE from "three";
import { SceneManager } from "@engine/SceneManager";
import {
  Playfield,
  PLAYFIELD_HEIGHT,
  PLAYFIELD_TILT_DEG,
  PLAYFIELD_WIDTH,
} from "@modules/playfield/Playfield";
import { Ball } from "@modules/ball";
import { RapierPhysicsAdapter } from "@physics/RapierPhysicsAdapter";
import viteLogo from "../public/vite.svg";
import typescriptLogo from "./typescript.svg";

// Import
import { Flipper } from "@modules/flipper/Flipper";

document.querySelector<HTMLDivElement>("#app")!.innerHTML = `
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
`;

const sceneManager = new SceneManager();

// Eclairage temporaire — sera remplacé par le module lighting (Issue 12)
const ambientLight = new THREE.AmbientLight(0xffffff, 0.4);
sceneManager.scene.add(ambientLight);

const directionalLight = new THREE.DirectionalLight(0xffffff, 1);
directionalLight.position.set(5, 10, 5);
directionalLight.castShadow = true;
sceneManager.scene.add(directionalLight);

// Playfield
const playfield = new Playfield();
playfield.addTo(sceneManager.scene);

let ball: Ball | null = null;

// Positionner la caméra pour voir la table en perspective
sceneManager.camera.position.set(0, 8, 10);
sceneManager.camera.lookAt(0, 0, 0);

// Monde physique
const physics = new RapierPhysicsAdapter();

async function initPhysics() {
  // Initialiser Rapier (attend le WASM)
  await physics.init();

  // Créer le monde physique
  physics.createBounds({
    y: 0,
    length: PLAYFIELD_HEIGHT,
    width: PLAYFIELD_WIDTH,
    tiltDeg: PLAYFIELD_TILT_DEG,
  });

  // Balle
  ball = new Ball(physics, {
    id: "main-ball",
    initialPosition: { x: 0, y: 1.5, z: 3 },
    radius: 0.12,
    mass: 0.08,
    friction: 0.12,
    restitution: 0.55,
  });
  ball.addTo(sceneManager.scene);

  const flipper = new Flipper((physics as any).world); // On passe le world Rapier
  flipper.addTo(sceneManager.scene);

  // Callback simulation physique
  sceneManager.onUpdate((deltaTime) => {
    physics.step(deltaTime);
    ball?.updateFromPhysics();
  });

  // Ici on démarrer la render loop
  sceneManager.start();
}

// Nettoyage à la fermeture
window.addEventListener("beforeunload", () => {
  ball?.dispose();
  ball?.removeFrom(sceneManager.scene);
  ball = null;

  playfield.dispose();
  playfield.removeFrom(sceneManager.scene);

  physics.dispose();
  sceneManager.dispose();
});

// Lancement de l'initialisation
initPhysics().catch((err) => {
  console.error("Erreur lors de l'initialisation de la physique :", err);
});
