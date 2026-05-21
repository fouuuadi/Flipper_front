import "./styles/global.css";

import * as THREE from "three";
import { SceneManager } from "@engine/SceneManager";
import { Launcher } from "@modules/launcher/launcher";
import {
  Playfield,
  PLAYFIELD_HEIGHT,
  PLAYFIELD_TILT_DEG,
  PLAYFIELD_WIDTH,
} from "@modules/playfield";
import { Ball } from "@modules/ball";
import { RapierPhysicsAdapter } from "@physics/RapierPhysicsAdapter";
import { Flipper } from "@modules/flipper";
import { TableBoundaries } from "@modules/table";
import { Splash } from "@modules/splash";

const sceneManager = new SceneManager();

const ambientLight = new THREE.AmbientLight(0xffffff, 0.4);
sceneManager.scene.add(ambientLight);

const directionalLight = new THREE.DirectionalLight(0xffffff, 1);
directionalLight.position.set(5, 10, 5);
directionalLight.castShadow = true;
sceneManager.scene.add(directionalLight);

const playfield = new Playfield();
playfield.addTo(sceneManager.scene);

let ball: Ball | null = null;
let tableBoundaries: TableBoundaries | null = null;

sceneManager.camera.position.set(0, 8, 10);
sceneManager.camera.lookAt(0, 0, 0);

const physics = new RapierPhysicsAdapter();

async function initPhysics() {
  await physics.init();

  const world = physics.getWorld();

  physics.createBounds({
    y: 0,
    length: PLAYFIELD_HEIGHT,
    width: PLAYFIELD_WIDTH,
    tiltDeg: PLAYFIELD_TILT_DEG,
  });

  ball = new Ball(physics, {
    id: "main-ball",
    initialPosition: { x: 0, y: 1.5, z: 3 },
    radius: 0.12,
    mass: 0.08,
    friction: 0.12,
    restitution: 0.55,
  });

  ball.addTo(sceneManager.scene);

  const leftFlipper = new Flipper(world, "left");
  leftFlipper.addTo(sceneManager.scene);

  const rightFlipper = new Flipper(world, "right");
  rightFlipper.addTo(sceneManager.scene);

  tableBoundaries = new TableBoundaries(world);
  tableBoundaries.addTo(sceneManager.scene);

  // Ici on gere le launcher avec la balle
  const launcher = new Launcher(ball);
  launcher.addTo(sceneManager.scene);

  sceneManager.onUpdate((deltaTime) => {
    physics.step(deltaTime);
    ball?.updateFromPhysics();

    leftFlipper.update(deltaTime);
    rightFlipper.update(deltaTime);

    launcher.update(deltaTime);
  });

  sceneManager.start();
}

window.addEventListener("beforeunload", () => {
  ball?.dispose();
  ball?.removeFrom(sceneManager.scene);
  ball = null;

  playfield.dispose();
  playfield.removeFrom(sceneManager.scene);

  tableBoundaries?.dispose();
  tableBoundaries?.removeFrom(sceneManager.scene);
  tableBoundaries = null;

  physics.dispose();
  sceneManager.dispose();
});

async function bootstrap() {
  // 1. Écran d'accueil — bloque jusqu'à l'appui sur A/Enter/Space
  // TODO: remplacer par un event PRESS_A → state machine (cf issue #80)
  const splash = new Splash();
  await splash.start();

  // 2. Démarrage de la 3D et de la physique
  await initPhysics();
}

bootstrap().catch((err) => {
  console.error("Erreur au démarrage :", err);
});
