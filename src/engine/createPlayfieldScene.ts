import * as THREE from "three";
import type RAPIER from "@dimforge/rapier3d-compat";
import { SceneManager } from "./SceneManager";
import { Launcher } from "@modules/launcher/launcher";
import { Playfield } from "@modules/playfield";
import { Ball } from "@modules/ball";
import { RapierPhysicsAdapter } from "@physics/RapierPhysicsAdapter";
import { Flipper } from "@modules/flipper";
import { TableBoundaries } from "@modules/table";

export interface PlayfieldScene {
  readonly sceneManager: SceneManager;
  readonly leftFlipper: Flipper;
  readonly rightFlipper: Flipper;
  readonly launcher: Launcher;
  readonly world: RAPIER.World;
}

/**
 * Construit la scène 3D du playfield (lumières, caméra, physique Rapier, bille,
 * flippers, lanceur), démarre la boucle de rendu et branche le cleanup au
 * `beforeunload`. Tourne en arrière-plan, sous les overlays UI (qui sont
 * `position: fixed; z-index: …`, donc toujours au-dessus du canvas).
 *
 * @returns la scène prête, avec les flippers exposés pour le bridge Blender.
 */
export async function createPlayfieldScene(): Promise<PlayfieldScene> {
  const sceneManager = new SceneManager();

  const ambientLight = new THREE.AmbientLight(0xffffff, 0.4);
  sceneManager.scene.add(ambientLight);

  const directionalLight = new THREE.DirectionalLight(0xffffff, 1);
  directionalLight.position.set(5, 10, 5);
  directionalLight.castShadow = true;
  sceneManager.scene.add(directionalLight);

  // Le visuel de la table provient du modèle Blender (GLB) chargé par
  // l'appelant ; les objets Three.js de la couche gameplay ne sont pas ajoutés
  // à la scène et ne servent qu'à la physique.
  const playfield = new Playfield();

  // Cadrage calé via la GUI debug 3D (DEV) puis figé. fov/near/far restent les
  // défauts de SceneManager (75 / 0.1 / 1000).
  sceneManager.camera.position.set(0, 29.0003, -0.9883);
  sceneManager.camera.lookAt(0, 0, 0);

  const physics = new RapierPhysicsAdapter();
  await physics.init();

  const world = physics.getWorld();

  physics.createBounds({
    y: 4.36,
    length: 31,
    width: 17,
    tiltDeg: 0,
  });

  const ball = new Ball(physics, {
    id: "main-ball",
    initialPosition: { x: 2.0, y: 4.92, z: -4.8 },
    radius: 0.24,
    mass: 0.08,
    friction: 0.12,
    restitution: 0.55,
  });
  ball.addTo(sceneManager.scene);

  const leftFlipper = new Flipper(world, "left");
  const rightFlipper = new Flipper(world, "right");
  if (import.meta.env.DEV) {
    leftFlipper.addDebugTo(sceneManager.scene);
    rightFlipper.addDebugTo(sceneManager.scene);
  }
  const tableBoundaries = new TableBoundaries(world);
  const launcher = new Launcher(ball);

  sceneManager.onUpdate((deltaTime) => {
    physics.step(deltaTime);
    ball.updateFromPhysics();

    leftFlipper.update(deltaTime);
    rightFlipper.update(deltaTime);

    launcher.update(deltaTime);
  });

  sceneManager.start();

  window.addEventListener("beforeunload", () => {
    ball.dispose();
    ball.removeFrom(sceneManager.scene);

    playfield.dispose();
    playfield.removeFrom(sceneManager.scene);

    tableBoundaries.dispose();
    tableBoundaries.removeFrom(sceneManager.scene);

    physics.dispose();
    sceneManager.dispose();
  });

  return { sceneManager, leftFlipper, rightFlipper, launcher, world };
}
