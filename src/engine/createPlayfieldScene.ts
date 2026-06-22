import * as THREE from "three";
import type RAPIER from "@dimforge/rapier3d-compat";
import { RGBELoader } from "three/addons/loaders/RGBELoader.js";
import { SceneManager } from "./SceneManager";
import { Launcher } from "@modules/launcher/launcher";
import { Playfield } from "@modules/playfield";
import { Ball } from "@modules/ball";
import { RapierPhysicsAdapter } from "@physics/RapierPhysicsAdapter";
import { Flipper } from "@modules/flipper";
import { TableBoundaries } from "@modules/table";

// Cf. `physics.createBounds({ length: 31, width: 17, y: 4.36 })` plus bas :
// la table est centrée sur l'origine, longueur 31 le long de Z.
const TABLE_Y = 4.36;
const TABLE_HALF_LENGTH = 31 / 2;
const SUN_COLOR = 0xffd76a;

/**
 * Charge `nebula_3.hdr` : posée en `scene.background`, elle entoure toute la
 * table (skybox visible à l'extérieur du playfield) ; le rendu PMREM associé
 * alimente `scene.environment`, la lumière d'ambiance (IBL) qui éclaire tout
 * le playfield aux couleurs de la nébuleuse plutôt qu'un simple blanc plat.
 */
async function loadNebulaEnvironment(
  renderer: THREE.WebGLRenderer,
  scene: THREE.Scene,
): Promise<void> {
  const pmremGenerator = new THREE.PMREMGenerator(renderer);
  pmremGenerator.compileEquirectangularShader();

  const hdrTexture = await new RGBELoader().loadAsync("/nebula_3.hdr");
  hdrTexture.mapping = THREE.EquirectangularReflectionMapping;

  const envRenderTarget = pmremGenerator.fromEquirectangular(hdrTexture);

  scene.background = hdrTexture;
  scene.environment = envRenderTarget.texture;

  pmremGenerator.dispose();
}

/**
 * Lumière "soleil" posée à une extrémité de la table (cf. les soleils
 * dessinés en haut/bas du playfield), au plus près du plan de jeu.
 */
function createTableEndLight(z: number): THREE.PointLight {
  const light = new THREE.PointLight(SUN_COLOR, 9, 24, 2);
  light.position.set(0, TABLE_Y + 2, z);
  return light;
}

export interface PlayfieldScene {
  readonly sceneManager: SceneManager;
  readonly leftFlipper: Flipper;
  readonly rightFlipper: Flipper;
  readonly launcher: Launcher;
  readonly world: RAPIER.World;
  readonly ball: Ball;
  readonly physics: RapierPhysicsAdapter;
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

  const ambientLight = new THREE.AmbientLight(0xffffff, 0.25);
  sceneManager.scene.add(ambientLight);

  const directionalLight = new THREE.DirectionalLight(0xffffff, 1);
  directionalLight.position.set(5, 10, 5);
  directionalLight.castShadow = true;
  sceneManager.scene.add(directionalLight);

  // Lumière d'ambiance issue de la nébuleuse (éclaire tout le playfield),
  // + deux "soleils" aux deux extrémités de la table, au plus près du jeu.
  await loadNebulaEnvironment(sceneManager.renderer, sceneManager.scene);

  const topEndLight = createTableEndLight(-TABLE_HALF_LENGTH + 1.5);
  const bottomEndLight = createTableEndLight(TABLE_HALF_LENGTH - 1.5);
  sceneManager.scene.add(topEndLight, bottomEndLight);

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
    friction: 0.42,
  });

  const ball = new Ball(physics, {
    id: "main-ball",
    initialPosition: { x: -7.6, y: 4.92, z: -11.9 },
    radius: 0.35,
    mass: 0.22,
    friction: 0.04,
    restitution: 0.34,
    linearDamping: 0.025,
    angularDamping: 0.015,
    maxLinearSpeed: 18,
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

  return { sceneManager, leftFlipper, rightFlipper, launcher, world, ball, physics };
}
