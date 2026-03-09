import * as THREE from "three";
import { SceneManager } from "@engine/SceneManager";
import { Playfield } from "@modules/playfield/Playfield";

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

sceneManager.start();
