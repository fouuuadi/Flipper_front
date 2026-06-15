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
import { loadBlenderTable } from "@modules/table/BlenderTableLoader";

import { gameStore } from "@core/gameStore";
import { applyDevBoot } from "@core/devBoot";
import { ScreenRouter, type ScreenFactoryMap } from "@core/screenRouter";
import { KeyboardDispatcher } from "@core/keyboardDispatcher";
import { KeybindingsHelp, KeybindingsHelpHint } from "@modules/ui";
import { MatchTimer } from "@modules/matchTimer";
import { bindMatchSyncToGameStore, matchSync } from "@services/matchSync";

import { Splash } from "@modules/splash";
import { Menu } from "@modules/menu";
import { Identification } from "@modules/identification";
import { Pause } from "@modules/pause";
import { GameOver } from "@modules/gameOver";
import { Leaderboard } from "@modules/leaderboard";

// ─────────────────────────────────────────────────────────────────────────────
// 3D — initialisée en arrière-plan, tourne en parallèle des écrans UI.
// Le splash, le menu, etc. sont des overlays mounted par le `ScreenRouter`.
// ─────────────────────────────────────────────────────────────────────────────

const sceneManager = new SceneManager();

const ambientLight = new THREE.AmbientLight(0xffffff, 0.4);
sceneManager.scene.add(ambientLight);

const directionalLight = new THREE.DirectionalLight(0xffffff, 1);
directionalLight.position.set(5, 10, 5);
directionalLight.castShadow = true;
sceneManager.scene.add(directionalLight);

// Le visuel de la table provient du modèle Blender (GLB) chargé plus bas ; les
// objets Three.js de la couche gameplay ne sont donc plus ajoutés à la scène et
// ne servent qu'à la physique.
const playfield = new Playfield();

let ball: Ball | null = null;
let tableBoundaries: TableBoundaries | null = null;

// Flippers au scope module pour être accessibles dans bootstrap() (bridges Blender)
let leftFlipper: Flipper | null = null;
let rightFlipper: Flipper | null = null;

sceneManager.camera.position.set(0, 3, 10);
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

  leftFlipper = new Flipper(world, "left");
  rightFlipper = new Flipper(world, "right");
  tableBoundaries = new TableBoundaries(world);
  const launcher = new Launcher(ball);

  sceneManager.onUpdate((deltaTime) => {
    physics.step(deltaTime);
    ball?.updateFromPhysics();

    leftFlipper?.update(deltaTime);
    rightFlipper?.update(deltaTime);

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

// ─────────────────────────────────────────────────────────────────────────────
// UI — ScreenRouter pilote le cycle de vie de chaque écran selon la SM.
// L'état `playing` n'a pas de factory : seule la 3D reste à l'écran.
// ─────────────────────────────────────────────────────────────────────────────

const factories: ScreenFactoryMap = {
  splash: (host) => {
    const splash = new Splash();
    splash.mount(host);
    return { stop: () => splash.unmount() };
  },
  menu: (host) => {
    const menu = new Menu();
    menu.mount(host);
    return { stop: () => menu.unmount() };
  },
  identification: (host) => {
    const id = new Identification();
    id.mount(host);
    return { stop: () => id.unmount() };
  },
  paused: (host) => {
    const pause = new Pause();
    pause.mount(host);
    return { stop: () => pause.unmount() };
  },
  gameOver: (host) => {
    const go = new GameOver();
    go.mount(host);
    return { stop: () => go.unmount() };
  },
  leaderboard: (host) => {
    const lb = new Leaderboard();
    lb.mount(host);
    return { stop: () => lb.unmount() };
  },
};

async function bootstrap() {
  // 0. Bypass de dev (`?boot=playing`) : bascule la SM avant tout abonnement
  //    pour que MatchTimer et ScreenRouter reçoivent l'état cible dès leur
  //    subscribe initial. No-op sans le query param et en prod.
  applyDevBoot(gameStore);

  // 1. Câbler les events serveur (match:state) sur la SM. Idempotent : peut
  //    s'abonner sans WS ouverte ; l'écran identification déclenchera le
  //    `matchSync.connect()` une fois la session créée.
  bindMatchSyncToGameStore(matchSync, gameStore);

  // 2. Dispatcher clavier global (Échap → PAUSE/RESUME, A → ABANDON, etc.)
  new KeyboardDispatcher({ store: gameStore, sync: matchSync }).start();

  // 3. Modal d'aide raccourcis (touche `?` n'importe où dans l'app)
  new KeybindingsHelp({ store: gameStore }).start();

  // 3bis. Hint visuel discret pour faire découvrir la modal (caché en `playing`
  //      et quand la modal est ouverte)
  new KeybindingsHelpHint({ store: gameStore }).start();

  // 4. MatchTimer côté playfield : chronomètre la durée effective d'une
  //    partie (hors pauses). Synchronisé sur l'état SM. Au gameOver,
  //    dispatche `SET_FINAL_DURATION` pour persister la valeur dans le
  //    contexte SM (consommée par l'écran gameOver pour affichage).
  const matchTimer = new MatchTimer();
  gameStore.subscribe(({ value }) => {
    const phase = matchTimer.getPhase();
    switch (value) {
      case "playing":
        if (phase === "idle") matchTimer.start();
        else if (phase === "frozen") matchTimer.unfreeze();
        break;
      case "paused":
        if (phase === "running") matchTimer.freeze();
        break;
      case "gameOver":
        if (phase === "running" || phase === "frozen") {
          matchTimer.stop();
          gameStore.send({
            type: "SET_FINAL_DURATION",
            durationMs: matchTimer.getElapsedMs(),
          });
        }
        break;
      case "splash":
      case "menu":
      case "identification":
      case "leaderboard":
        if (phase !== "idle") matchTimer.reset();
        break;
    }
  });

  // 5. Routeur d'écrans — l'état initial de la SM (`splash`) est monté
  //    immédiatement par le `subscribe` initial.
  new ScreenRouter(document.body, gameStore, factories).start();

  // 6. 3D en arrière-plan (le canvas est sous tous les overlays UI)
  await initPhysics();

  // 7. Charger la table Blender et brancher les bridges flipper
  //    leftFlipper / rightFlipper sont garantis non-null après initPhysics()
  if (leftFlipper && rightFlipper) {
    loadBlenderTable(sceneManager.scene, leftFlipper, rightFlipper)
      .then(({ bridges }) => {
        console.log(`🎰 ${bridges.length} bridge(s) flipper actif(s)`);
        sceneManager.onUpdate(() => {
          for (const bridge of bridges) bridge.update();
        });
      })
      .catch((err) => {
        console.error("❌ Impossible de charger la table Blender :", err);
      });
  }
}

bootstrap().catch((err) => {
  console.error("Erreur au démarrage :", err);
});
