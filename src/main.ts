import "./styles/global.css";

import { createPlayfieldScene } from "@engine/createPlayfieldScene";
import { loadBlenderTable } from "@modules/table/BlenderTableLoader";

import { gameStore } from "@core/gameStore";
import { applyDevBoot } from "@core/devBoot";
import { ScreenRouter, type ScreenFactoryMap } from "@core/screenRouter";
import { KeyboardDispatcher } from "@core/keyboardDispatcher";
import { KeybindingsHelp, KeybindingsHelpHint } from "@modules/ui";
import { bindMatchTimerToStore } from "@modules/matchTimer";
import { bindMatchSyncToGameStore, matchSync } from "@services/matchSync";

import { Splash } from "@modules/splash";
import { Menu } from "@modules/menu";
import { Identification } from "@modules/identification";
import { Pause } from "@modules/pause";
import { GameOver } from "@modules/gameOver";
import { Leaderboard } from "@modules/leaderboard";

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

  // 4. MatchTimer : chronomètre la durée effective d'une partie (hors pauses),
  //    piloté par l'état SM ; persiste la durée finale au gameOver.
  bindMatchTimerToStore(gameStore);

  // 5. Routeur d'écrans — l'état initial de la SM (`splash`) est monté
  //    immédiatement par le `subscribe` initial.
  new ScreenRouter(document.body, gameStore, factories).start();

  // 6. Scène 3D en arrière-plan (le canvas est sous tous les overlays UI).
  const { sceneManager, leftFlipper, rightFlipper } = await createPlayfieldScene();

  // 7. Charger la table Blender et brancher les bridges flipper.
  loadBlenderTable(sceneManager.scene, leftFlipper, rightFlipper)
    .then(({ bridges }) => {
      sceneManager.onUpdate(() => {
        for (const bridge of bridges) bridge.update();
      });
    })
    .catch((err) => {
      console.error("Impossible de charger la table Blender :", err);
    });
}

bootstrap().catch((err) => {
  console.error("Erreur au démarrage :", err);
});
