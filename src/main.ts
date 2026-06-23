import "./styles/global.css";

import { createPlayfieldScene } from "@engine/createPlayfieldScene";
import { loadBlenderTable } from "@modules/table/BlenderTableLoader";
import { TableInteractions } from "@modules/table/TableInteractions";
import { Slingshot } from "@modules/slingshot";

import { gameStore } from "@core/gameStore";
import { applyDevBoot } from "@core/devBoot";
import { isDevLocalSyncEnabled } from "@core/devLocalSync";
import { ScreenRouter, type ScreenFactory, type ScreenFactoryMap } from "@core/screenRouter";
import { KeyboardDispatcher } from "@core/keyboardDispatcher";
import { KeybindingsHelp, KeybindingsHelpHint } from "@modules/ui";
import { bindBorneGameplay, bindGameplayInput } from "@modules/gameplayInput";
import { GameFlow } from "@modules/gameplay/GameFlow";
import { bindMatchTimerToStore } from "@modules/matchTimer";
import { bindMatchSyncToGameStore, matchSync } from "@services/matchSync";

import { Splash } from "@modules/splash";
import { Pause } from "@modules/pause";
import { GameOver } from "@modules/gameOver";
import { Leaderboard } from "@modules/leaderboard";
import { Menu } from "@modules/menu";

// ─────────────────────────────────────────────────────────────────────────────
// UI — rôle du PLAYFIELD : il reste sur le splash pendant TOUTE la navigation
// (menu / identification / boutique / settings / leaderboard se font sur le
// backglass). Au passage en jeu (`nav:state: in_game` → `playing`), le splash
// est démonté et seule la 3D reste, avec les overlays pause / game over.
// ─────────────────────────────────────────────────────────────────────────────

// Même référence de factory pour tous les états de navigation → grâce à la
// déduplication par factory du ScreenRouter, le splash reste monté sans flicker.
const splashScreen: ScreenFactory = (host) => {
  const splash = new Splash();
  splash.mount(host);
  return { stop: () => splash.unmount() };
};

const factories: ScreenFactoryMap = {
  splash: splashScreen,
  menu: (host) => {
    const menu = new Menu();
    menu.mount(host);
    return { stop: () => menu.unmount() };
  },
  identification: splashScreen,
  leaderboard: (host) => {
    const leaderboard = new Leaderboard();
    leaderboard.mount(host);
    return { stop: () => leaderboard.unmount() };
  },
  cosmetics: splashScreen,
  settings: splashScreen,
  // playing : pas de factory → seule la 3D reste à l'écran.
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
};

async function bootstrap() {
  // 0. Bypass de dev (`?boot=playing`) : bascule la SM avant tout abonnement
  //    pour que MatchTimer et ScreenRouter reçoivent l'état cible dès leur
  //    subscribe initial. No-op sans le query param et en prod.
  applyDevBoot(gameStore);

  // 1. Mode follower : le backend décide, le front applique. On branche le bus
  //    borne sur la SM (nav:state + match:state) et on ouvre la connexion
  //    permanente au boot — bien avant toute partie.
  if (!isDevLocalSyncEnabled()) {
    bindMatchSyncToGameStore(matchSync, gameStore);
    matchSync.connectBorne();
  }

  // 2. Dispatcher clavier global (Échap → PAUSE/RESUME, A → ABANDON, etc.)
  new KeyboardDispatcher({ store: gameStore, sync: matchSync }).start();

  // 3. Modal d'aide raccourcis (touche `?` n'importe où dans l'app)
  new KeybindingsHelp({ store: gameStore }).start();

  // 3bis. Hint visuel discret pour faire découvrir la modal (caché en `playing`
  //      et quand la modal est ouverte)
  new KeybindingsHelpHint({ store: gameStore }).start();

  // 4. MatchTimer : chronomètre la durée effective d'une partie (hors pauses),
  //    piloté par l'état SM ; persiste la durée finale au gameOver.
  bindMatchTimerToStore(gameStore);

  // 5. Routeur d'écrans — l'état initial de la SM (`splash`) est monté
  //    immédiatement par le `subscribe` initial.
  new ScreenRouter(document.body, gameStore, factories).start();

  // 6. Scène 3D en arrière-plan (le canvas est sous tous les overlays UI).
  const { sceneManager, leftFlipper, rightFlipper, launcher, world, ball, physics } =
    await createPlayfieldScene();

  // 6bis. Sources gameplay (flippers + lanceur), actives uniquement en
  //       `playing`. Le playfield est un client borne par nature, donc on
  //       écoute toujours les boutons physiques relayés par le backend
  //       (`bindBorneGameplay`) ; le clavier ne s'ajoute qu'en dev.
  const gameplayControls = { leftFlipper, rightFlipper, launcher };
  bindBorneGameplay(gameStore, gameplayControls, matchSync);
  if (import.meta.env.DEV) {
    bindGameplayInput(gameStore, gameplayControls);
  }

  // 7. Charger la table Blender et brancher les bridges flipper.
  loadBlenderTable(sceneManager.scene, leftFlipper, rightFlipper, world)
    .then(({ bridges, tableRoot, colliders }) => {
      sceneManager.onUpdate(() => {
        for (const bridge of bridges) bridge.update();
      });

      // 7bis. Slingshot actif : repousse la bille avec une impulsion
      //       réactive façon ressort dès que le triangle Blender est trouvé.
      const slingshotCollider = colliders["Slingshot_triangle"];
      if (slingshotCollider) {
        const slingshot = new Slingshot(physics, ball, slingshotCollider);
        sceneManager.onUpdate((deltaTime) => slingshot.update(deltaTime));
      } else if (import.meta.env.DEV) {
        console.warn('⚠️ "Slingshot_triangle" introuvable, slingshot actif désactivé');
      }

      // GUI de dépannage 3D (positionnement table) — DEV uniquement, jamais
      // embarqué dans le build borne/prod.
      const tableInteractions = new TableInteractions(
        physics,
        ball,
        colliders,
        tableRoot,
        sceneManager.scene,
        sceneManager.camera,
      );
      sceneManager.onUpdate((deltaTime) => tableInteractions.update(deltaTime));

      const gameFlow = new GameFlow(
        physics,
        ball,
        colliders,
        matchSync,
        () => {
          gameStore.send({ type: "GAME_OVER" });
        },
        isDevLocalSyncEnabled(),
      );
      sceneManager.onUpdate((deltaTime) => gameFlow.update(deltaTime));
      let previousState = gameStore.getState().value;
      gameStore.subscribe((snapshot) => {
        const startsNewGame =
          snapshot.value === "playing" &&
          previousState !== "playing" &&
          previousState !== "paused";
        if (startsNewGame) {
          gameFlow.reset();
        }
        previousState = snapshot.value;
      });
      if (isDevLocalSyncEnabled()) {
        matchSync.emitLocal({ type: "match:state", status: "playing", sessionId: "local-dev" });
      }

      if (import.meta.env.DEV) {
        void import("@modules/debug/TableDebugGui").then(({ createTableDebugGui }) =>
          createTableDebugGui({ sceneManager, tableRoot }),
        );
      }
    })
    .catch((err) => {
      console.error("Impossible de charger la table Blender :", err);
    });
}

bootstrap().catch((err) => {
  console.error("Erreur au démarrage :", err);
});
