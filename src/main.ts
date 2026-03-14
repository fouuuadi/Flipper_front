import * as THREE from "three";
import { SceneManager } from "@engine/SceneManager";
import { Playfield } from "@modules/playfield/Playfield";
import { gameStateStore, GameState } from "@core/index";

// Ici j'ai mis une var temp pour le template HTML
const viteLogo = "/vite.svg";
const typescriptLogo = "/typescript.svg";

const sceneManager = new SceneManager();

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

sceneManager.start();

// Ici je test GameStateStore (Issue 9)
gameStateStore.subscribe((state: GameState) => {
  console.log("GameState changed:", state);
});

gameStateStore.setState(GameState.READY);
gameStateStore.setState(GameState.PLAYING);
