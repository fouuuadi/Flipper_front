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
import { loadBlenderTable } from "@modules/table/BlenderTableLoader";

// Event Bus
import { EventBus } from "@core/EventBus";
import type { SlingshotHitPayload } from "@modules/obstacles/Slingshot";

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
// Commentaire pour désactiver la table et la remplacé par le modèle Blender

let ball: Ball | null = null;
let tableBoundaries: TableBoundaries | null = null;

// Ici on met blender, références module pour le bridge Rapier, mesh Blender
let leftFlipper: Flipper | null = null;
let rightFlipper: Flipper | null = null;

sceneManager.camera.position.set(0, 3, 10);
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

  // Pour blender on assigne aux variables module pour le bridge
  leftFlipper = new Flipper(world, "left");

  rightFlipper = new Flipper(world, "right");

  tableBoundaries = new TableBoundaries(world);

  const launcher = new Launcher(ball);

  const leftSlingshot = new Slingshot(world, "left");

  const rightSlingshot = new Slingshot(world, "right");

  // Ici on gere le RigidBody de la balle aux slingshots
  const ballRigidBody = physics.getBody("main-ball");
  if (ballRigidBody) {
    leftSlingshot.setBallBody(ballRigidBody);
    rightSlingshot.setBallBody(ballRigidBody);
  }

  // Consol log de chaque slingshot_hit émis sur l'EventBus
  const slingshotEventBus = EventBus.getInstance<{ slingshot_hit: SlingshotHitPayload }>();
  slingshotEventBus.on("slingshot_hit", (payload) => {
    console.log(
      `🎯 slingshot_hit reçu — côté: ${payload.side}, impulse:`,
      payload.impulse,
    );
  });

  sceneManager.onUpdate((deltaTime) => {
    physics.step(deltaTime, eventQueue);

    // ici on gere les collision
    eventQueue.drainCollisionEvents((h1, h2, started) => {
      if (!started) return;

      console.log("COLLISION DETECTED", h1, h2);
    });

    ball?.updateFromPhysics();

    leftFlipper?.update(deltaTime);
    rightFlipper?.update(deltaTime);

    launcher.update(deltaTime);

    if (ball) {
      leftSlingshot.update(ball, deltaTime);
      rightSlingshot.update(ball, deltaTime);
    }
  });

  sceneManager.start();
}

// Ici on gére le demarrage physique d'abord, puis chargement du GLB Blender
// Les bridges sont ajoutés à la boucle onUpdate une fois le GLB prêt
initPhysics().then(() => {
  if (leftFlipper === null || rightFlipper === null) return;

  loadBlenderTable(sceneManager.scene, leftFlipper, rightFlipper)
    .then(({ bridges }) => {
      sceneManager.onUpdate(() => {
        bridges.forEach((bridge) => bridge.update());
      });
      console.log(`✅ ${bridges.length} bridge(s) Rapier → Blender actif(s)`);
    })
    .catch((err: unknown) => {
      console.error("❌ Échec du chargement de la table Blender :", err);
    });
});
