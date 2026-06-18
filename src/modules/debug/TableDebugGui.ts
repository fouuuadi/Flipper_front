import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import GUI from "lil-gui";
import type { SceneManager } from "@engine/SceneManager";

export interface TableDebugGuiOptions {
  sceneManager: SceneManager;
  /** Racine de la table Blender à positionner. */
  tableRoot: THREE.Object3D;
}

export interface TableDebugGui {
  dispose(): void;
}

/**
 * Panneau de dépannage 3D (DEV uniquement) pour caler la table dans la scène :
 * position / rotation / scale de la table, navigation caméra libre via
 * OrbitControls, helpers grille + axes. Un bouton « Copier le transform » met
 * dans le presse-papier un snippet prêt à coller dans `BlenderTableLoader`.
 *
 * Rien de ceci ne doit partir en prod : l'appelant le gate sur `import.meta.env.DEV`.
 */
export function createTableDebugGui({
  sceneManager,
  tableRoot,
}: TableDebugGuiOptions): TableDebugGui {
  const { scene, camera, renderer } = sceneManager;

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.target.set(0, 0, 0);
  controls.update();

  const gridHelper = new THREE.GridHelper(20, 20);
  const axesHelper = new THREE.AxesHelper(5);
  gridHelper.visible = false;
  axesHelper.visible = false;
  scene.add(gridHelper, axesHelper);

  const gui = new GUI({ title: "🔧 Debug 3D — Table" });

  // --- Table : position ---
  const tablePos = gui.addFolder("Table · Position");
  tablePos.add(tableRoot.position, "x", -10, 10, 0.01);
  tablePos.add(tableRoot.position, "y", -10, 10, 0.01);
  tablePos.add(tableRoot.position, "z", -10, 10, 0.01);

  // --- Table : rotation (exposée en degrés, stockée en radians) ---
  const rotDeg = {
    x: THREE.MathUtils.radToDeg(tableRoot.rotation.x),
    y: THREE.MathUtils.radToDeg(tableRoot.rotation.y),
    z: THREE.MathUtils.radToDeg(tableRoot.rotation.z),
  };
  const applyRotation = (): void => {
    tableRoot.rotation.set(
      THREE.MathUtils.degToRad(rotDeg.x),
      THREE.MathUtils.degToRad(rotDeg.y),
      THREE.MathUtils.degToRad(rotDeg.z),
    );
  };
  const tableRot = gui.addFolder("Table · Rotation (°)");
  tableRot.add(rotDeg, "x", -180, 180, 0.5).onChange(applyRotation);
  tableRot.add(rotDeg, "y", -180, 180, 0.5).onChange(applyRotation);
  tableRot.add(rotDeg, "z", -180, 180, 0.5).onChange(applyRotation);

  // --- Table : scale uniforme ---
  const scaleProxy = { uniform: tableRoot.scale.x };
  const tableScale = gui.addFolder("Table · Échelle");
  tableScale
    .add(scaleProxy, "uniform", 0.01, 10, 0.01)
    .name("scale")
    .onChange((v: number) => tableRoot.scale.setScalar(v));

  // --- Caméra ---
  // position / target sont en `.listen()` : ils reflètent en direct les
  // déplacements faits à la souris via OrbitControls (orbit / pan / zoom),
  // et restent éditables au slider pour un calage fin.
  const refreshProjection = (): void => camera.updateProjectionMatrix();
  const camFolder = gui.addFolder("Caméra · Position");
  camFolder.add(camera.position, "x", -50, 50, 0.1).listen().onChange(() => controls.update());
  camFolder.add(camera.position, "y", -50, 50, 0.1).listen().onChange(() => controls.update());
  camFolder.add(camera.position, "z", -50, 50, 0.1).listen().onChange(() => controls.update());

  const camTarget = gui.addFolder("Caméra · Point visé (target)");
  camTarget.add(controls.target, "x", -50, 50, 0.1).listen().onChange(() => controls.update());
  camTarget.add(controls.target, "y", -50, 50, 0.1).listen().onChange(() => controls.update());
  camTarget.add(controls.target, "z", -50, 50, 0.1).listen().onChange(() => controls.update());

  const camLens = gui.addFolder("Caméra · Objectif");
  camLens.add(camera, "fov", 10, 120, 1).onChange(refreshProjection);
  camLens.add(camera, "near", 0.01, 10, 0.01).onChange(refreshProjection);
  camLens.add(camera, "far", 10, 5000, 10).onChange(refreshProjection);

  // --- Helpers ---
  const helpers = gui.addFolder("Helpers");
  helpers.add(gridHelper, "visible").name("grille");
  helpers.add(axesHelper, "visible").name("axes");
  helpers.add(controls, "enabled").name("OrbitControls");

  // --- Export ---
  const fmt = (n: number): string => n.toFixed(3);
  const copyToClipboard = async (label: string, snippet: string): Promise<void> => {
    console.log(`[Debug 3D] ${label} :\n${snippet}`);
    try {
      await navigator.clipboard.writeText(snippet);
      console.log("[Debug 3D] ✓ copié dans le presse-papier");
    } catch {
      console.warn("[Debug 3D] presse-papier indisponible — copie depuis la console ci-dessus");
    }
  };
  const actions = {
    copierTable: async (): Promise<void> => {
      const p = tableRoot.position;
      const r = tableRoot.rotation;
      const s = tableRoot.scale;
      const snippet = [
        `tableRoot.position.set(${fmt(p.x)}, ${fmt(p.y)}, ${fmt(p.z)});`,
        `tableRoot.rotation.set(${fmt(r.x)}, ${fmt(r.y)}, ${fmt(r.z)}); // radians`,
        `tableRoot.scale.setScalar(${fmt(s.x)});`,
      ].join("\n");
      await copyToClipboard("transform table", snippet);
    },
    copierCamera: async (): Promise<void> => {
      const p = camera.position;
      const t = controls.target;
      // Prêt à coller dans SceneManager (pas d'OrbitControls en prod → lookAt).
      const snippet = [
        `this.camera.fov = ${fmt(camera.fov)};`,
        `this.camera.near = ${fmt(camera.near)};`,
        `this.camera.far = ${fmt(camera.far)};`,
        `this.camera.position.set(${fmt(p.x)}, ${fmt(p.y)}, ${fmt(p.z)});`,
        `this.camera.lookAt(${fmt(t.x)}, ${fmt(t.y)}, ${fmt(t.z)});`,
        `this.camera.updateProjectionMatrix();`,
      ].join("\n");
      await copyToClipboard("setup caméra", snippet);
    },
  };
  gui.add(actions, "copierTable").name("📋 Copier le transform table");
  gui.add(actions, "copierCamera").name("📷 Copier le setup caméra");

  // OrbitControls a besoin d'un update par frame (damping).
  const tick = (): void => {
    controls.update();
  };
  sceneManager.onUpdate(tick);

  return {
    dispose(): void {
      sceneManager.offUpdate(tick);
      gui.destroy();
      controls.dispose();
      scene.remove(gridHelper, axesHelper);
      gridHelper.dispose();
      axesHelper.dispose();
    },
  };
}
