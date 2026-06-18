import * as THREE from "three";
import { SceneManager } from "./SceneManager";
import { Launcher } from "@modules/launcher/launcher";
import { PLAYFIELD_TILT_DEG } from "@modules/playfield";
import { Ball } from "@modules/ball";
import { RapierPhysicsAdapter } from "@physics/RapierPhysicsAdapter";
import { Flipper } from "@modules/flipper";
import { TableBoundaries } from "@modules/table";

export interface PlayfieldScene {
  readonly sceneManager: SceneManager;
  readonly leftFlipper: Flipper;
  readonly rightFlipper: Flipper;
  readonly launcher: Launcher;
  readonly physics: RapierPhysicsAdapter;
}

/**
 * Ici on construit la scène 3D du playfield (lumières, caméra, physique Rapier, bille,
 * flippers, lanceur), et on démarre la boucle de rendu et branche le cleanup.
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

  // Ici on désactive la table par défaut on ne joue plus que sur la table 3D Blender.

sceneManager.camera.position.set(0, 6, -7);
sceneManager.camera.lookAt(0, 0, 1.5);

  //sceneManager.camera.position.set(0, 3, 10);
  //sceneManager.camera.lookAt(0, 0, 0);

  const physics = new RapierPhysicsAdapter();
  const tiltRad = THREE.MathUtils.degToRad(PLAYFIELD_TILT_DEG);
  const gravityMagnitude = 9.81;
  await physics.init({
    x: 0,
    y: -gravityMagnitude * Math.cos(tiltRad),
    z: -gravityMagnitude * Math.sin(tiltRad),
  });

  const world = physics.getWorld();

  // Ici on a un sol de secours pour ne pas laisser la balle tomber dans le vide 
  // pendant le chargement async du GLB.
  const blenderTableCenterZ = 1.12;
  const blenderTiltRad = -THREE.MathUtils.degToRad(PLAYFIELD_TILT_DEG);
  physics.addBody({
    id: "playfield",
    position: { x: 0, y: 0.13, z: blenderTableCenterZ },
    rotation: { x: blenderTiltRad, y: 0, z: 0 },
    isStatic: true,
    shape: "box",
    halfExtents: { x: 3.0, y: 0.2, z: 6.0 },
    friction: 0.25,
    restitution: 0.0,
  });

  const ball = new Ball(physics, {
    id: "main-ball",
    initialPosition: { x: 0, y: 2.0, z: 3.5 },
    radius: 0.12,
    mass: 0.08,
    friction: 0.12,
    restitution: 0.55,
  });
  ball.addTo(sceneManager.scene);

  const leftFlipper = new Flipper(world, "left");
  const rightFlipper = new Flipper(world, "right");
  // [DEBUG] Affiche le wireframe vert du collider physique réel de chaque
  // flipper, pour vérifier visuellement s'il est bien aligné avec le mesh
  // Blender visible — à retirer une fois l'alignement confirmé.
  leftFlipper.addTo(sceneManager.scene);
  rightFlipper.addTo(sceneManager.scene);
  // [DEBUG] Permet aux logs de collision (RapierPhysicsAdapter.step) d'identifier
  // ces colliders, créés directement par Flipper.ts (donc hors de addBody()).
  physics.registerColliderName(leftFlipper.collider.handle, "flipper-left");
  physics.registerColliderName(rightFlipper.collider.handle, "flipper-right");
  const tableBoundaries = new TableBoundaries(world);
  // Ici on désactive les murs procéduraux, la table Blender contient ses
  // propres meshes de murs (_wall_one, _wall_two, ...)
  const launcher = new Launcher(ball);

  sceneManager.onUpdate((deltaTime) => {
    // [FLIPPER] On met à jour les flippers à CHAQUE sous-pas physique (via le
    // hook onSubstep), pas une seule fois par frame visuelle : sinon, dès que
    // le FPS descend sous 60 (cf. plusieurs sous-pas par frame pour rattraper
    // le retard), le flipper recevait la même cible figée sur 2-5 sous-pas
    // d'affilée → vitesse effective quasi nulle pour Rapier sur ces sous-pas,
    // d'où un impact trop faible sur la balle ("piqûre" au lieu d'un vrai coup).
    physics.step(deltaTime, (fixedDt) => {
      leftFlipper.update(fixedDt);
      rightFlipper.update(fixedDt);
    });
    ball.updateFromPhysics();

    launcher.update(deltaTime);
  });

  sceneManager.start();

  window.addEventListener("beforeunload", () => {
    ball.dispose();
    ball.removeFrom(sceneManager.scene);

    // playfield.dispose();
    // playfield.removeFrom(sceneManager.scene);

    tableBoundaries.dispose();
    tableBoundaries.removeFrom(sceneManager.scene);

    physics.dispose();
    sceneManager.dispose();
  });

  return { sceneManager, leftFlipper, rightFlipper, launcher, physics };
}
