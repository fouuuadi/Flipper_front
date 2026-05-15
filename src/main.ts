import * as THREE from "three";
import RAPIER from "@dimforge/rapier3d-compat";

import { SceneManager } from "@engine/SceneManager";
import { Launcher } from "@modules/launcher/Launcher";
import { Slingshot } from "@modules/obstacles/Slingshot";

import {
  Playfield,
  PLAYFIELD_HEIGHT,
  PLAYFIELD_TILT_DEG,
  PLAYFIELD_WIDTH,
} from "@modules/playfield";

import { Ball } from "@modules/ball";
import { RapierPhysicsAdapter } from "@physics/RapierPhysicsAdapter";

import viteLogo from "../public/vite.svg";
import typescriptLogo from "./typescript.svg";

import { Flipper } from "@modules/flipper";
import { TableBoundaries } from "@modules/table";

document.querySelector<HTMLDivElement>("#app")!.innerHTML = `
  <div>
    <a href="https://vite.dev" target="_blank">
      <img src="${viteLogo}" class="logo" alt="Vite logo" />
    </a>
    <a href="https://www.typescriptlang.org/" target="_blank">
      <img src="${typescriptLogo}" class="logo vanilla" alt="TypeScript logo" />
    </a>
    <h1>Vite + TypeScript</h1>
  </div>
`;

const sceneManager = new SceneManager();

// Lighting
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
let tableBoundaries: TableBoundaries | null = null;

// Camera
sceneManager.camera.position.set(0, 8, 10);
sceneManager.camera.lookAt(0, 0, 0);

// Physics
const physics = new RapierPhysicsAdapter();

async function initPhysics() {
  await physics.init();

  const world = physics.getWorld();

  const eventQueue = new RAPIER.EventQueue(true);

  physics.createBounds({
    y: 0,
    length: PLAYFIELD_HEIGHT,
    width: PLAYFIELD_WIDTH,
    tiltDeg: PLAYFIELD_TILT_DEG,
  });

  ball = new Ball(physics, {
    id: "main-ball",
    initialPosition: { x: 0.5, y: 1.5, z: 2 },
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

  const launcher = new Launcher(ball);
  launcher.addTo(sceneManager.scene);

  const leftSlingshot = new Slingshot(world, "left");
  leftSlingshot.addTo(sceneManager.scene);

  const rightSlingshot = new Slingshot(world, "right");
  rightSlingshot.addTo(sceneManager.scene);

  sceneManager.onUpdate((deltaTime) => {
    physics.step(deltaTime, eventQueue);

    // Ici on gere les collision
    eventQueue.drainCollisionEvents((h1, h2, started) => {
      if (!started) return;

      console.log("COLLISION DETECTED", h1, h2);
    });

    ball?.updateFromPhysics();

    leftFlipper.update(deltaTime);
    rightFlipper.update(deltaTime);

    launcher.update(deltaTime);

    if (ball) {
      leftSlingshot.update(ball, deltaTime);
      rightSlingshot.update(ball, deltaTime);
    }
  });

  sceneManager.start();
}

initPhysics();
