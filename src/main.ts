import * as THREE from "three";
import { SceneManager } from "@engine/SceneManager";

const sceneManager = new SceneManager();

// Cube de test — sera remplacé par le playfield (Issue 11)
const geometry = new THREE.BoxGeometry();
const material = new THREE.MeshBasicMaterial({ color: 0xff0000 });
const cube = new THREE.Mesh(geometry, material);
sceneManager.scene.add(cube);

sceneManager.start();
