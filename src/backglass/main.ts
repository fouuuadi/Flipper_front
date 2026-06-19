import "../styles/global.css";

import { applyDevBoot } from "@core/devBoot";
import { isDevLocalSyncEnabled } from "@core/devLocalSync";
import { gameStore } from "@core/gameStore";
import { KeyboardDispatcher, dispatchIntent } from "@core/keyboardDispatcher";
import { ScreenRouter, type ScreenFactory, type ScreenFactoryMap } from "@core/screenRouter";
import { bindScreenNav } from "@modules/screenNav";
import { ControlsOverlay } from "@modules/controls";
import { bindMatchSyncToGameStore, matchSync } from "@services/matchSync";
import { menuAudio } from "@services/menuAudio";

import { BackglassApp } from "@modules/backglass";
import { CosmeticsStore } from "@modules/cosmetics";
import { Identification } from "@modules/identification";
import { Leaderboard } from "@modules/leaderboard";
import { Menu } from "@modules/menu";
import { Settings } from "@modules/settings";
import { Splash } from "@modules/splash";

const host = document.querySelector<HTMLDivElement>("#app");

// Rôle du BACKGLASS : il porte tout le parcours de navigation (menu,
// identification, boutique, settings, leaderboard) puis le HUD pendant la
// partie. Le HUD utilise la même référence de factory pour playing/paused/
// gameOver → grâce à la déduplication du ScreenRouter, BackglassApp reste monté
// pendant toute la partie (ses overlays internes rendent pause / game over),
// sans re-mount ni reconnexion.
const backglassHud: ScreenFactory = (screenHost) => {
  const app = new BackglassApp(screenHost);
  app.start(matchSync);
  return { stop: () => app.stop() };
};

// Écran secondaire : le bouton rouge (back) revient au menu. L'écran garde sa
// propre UI pour le reste (clavier / clic) ; la roulette d'identification
// affinera son `back` (effacer une lettre) au lot suivant.
const navScreen =
  (create: () => { mount: (host: HTMLElement) => void; unmount: () => void }): ScreenFactory =>
  (screenHost) => {
    const screen = create();
    screen.mount(screenHost);
    const unbindNav = bindScreenNav(
      { back: () => dispatchIntent({ type: "BACK_TO_MENU" }, { sync: matchSync }) },
      { sync: matchSync },
    );
    return {
      stop: () => {
        unbindNav();
        screen.unmount();
      },
    };
  };

// États de jeu : le HUD backglass + le bouton rouge (back) contextuel.
const hudWithBack =
  (back: () => void): ScreenFactory =>
  (screenHost, ctx) => {
    const hud = backglassHud(screenHost, ctx);
    const unbindNav = bindScreenNav({ back }, { sync: matchSync });
    return {
      stop: () => {
        unbindNav();
        hud.stop();
      },
    };
  };

const factories: ScreenFactoryMap = {
  splash: (screenHost) => {
    const splash = new Splash();
    splash.mount(screenHost);
    // Bouton vert (ou n'importe quelle touche en dev) → on entre dans le menu.
    const unbindNav = bindScreenNav(
      { confirm: () => dispatchIntent({ type: "PRESS_A" }, { sync: matchSync }) },
      { sync: matchSync },
    );
    return {
      stop: () => {
        unbindNav();
        splash.unmount();
      },
    };
  },
  menu: (screenHost) => {
    const menu = new Menu();
    menu.mount(screenHost);
    // Navigation au curseur : gauche/droite défilent, vert valide, rouge revient.
    const unbindNav = bindScreenNav(
      {
        left: () => menu.moveCursor(-1),
        right: () => menu.moveCursor(1),
        confirm: () => menu.confirmCursor(),
        back: () => dispatchIntent({ type: "BACK_TO_SPLASH" }, { sync: matchSync }),
      },
      { sync: matchSync, keyboard: true },
    );
    return {
      stop: () => {
        unbindNav();
        menu.unmount();
      },
    };
  },
  // L'identification câble sa propre nav borne (roulette de pseudo).
  identification: (screenHost) => {
    const identification = new Identification();
    identification.mount(screenHost);
    return { stop: () => identification.unmount() };
  },
  // Leaderboard : gauche/droite basculent l'onglet solo ↔ 1v1, rouge → menu.
  leaderboard: (screenHost) => {
    const leaderboard = new Leaderboard();
    leaderboard.mount(screenHost);
    const unbindNav = bindScreenNav(
      {
        left: () => leaderboard.toggleMode(),
        right: () => leaderboard.toggleMode(),
        back: () => dispatchIntent({ type: "BACK_TO_MENU" }, { sync: matchSync }),
      },
      { sync: matchSync, keyboard: true },
    );
    return {
      stop: () => {
        unbindNav();
        leaderboard.unmount();
      },
    };
  },
  cosmetics: navScreen(() => new CosmeticsStore()),
  settings: navScreen(() => new Settings()),
  // En jeu : rouge → pause. En pause : rouge → reprendre (abandonner = option
  // validée au vert). Game over : rouge → retour menu.
  playing: hudWithBack(() => dispatchIntent({ type: "PAUSE" }, { sync: matchSync })),
  paused: hudWithBack(() => dispatchIntent({ type: "RESUME" }, { sync: matchSync })),
  gameOver: hudWithBack(() => dispatchIntent({ type: "BACK_TO_MENU" }, { sync: matchSync })),
};

if (host) {
  menuAudio.startClickFeedback();
  applyDevBoot(gameStore);

  // Mode follower : on branche le bus borne sur la SM et on ouvre la connexion
  // permanente au boot. Le KeyboardDispatcher relaie aussi les inputs en intents.
  if (!isDevLocalSyncEnabled()) {
    bindMatchSyncToGameStore(matchSync, gameStore);
    matchSync.connectBorne();
  }
  new KeyboardDispatcher({ store: gameStore, sync: matchSync }).start();
  new ScreenRouter(host, gameStore, factories).start();

  // Bouton orange (help) : en jeu → pause ; en pause → reprise (le backend
  // relance un compte à rebours 3-2-1) ; hors jeu → overlay des contrôles.
  const controlsOverlay = new ControlsOverlay();
  controlsOverlay.mount(host);
  bindScreenNav(
    {
      help: () => {
        const state = gameStore.getState().value;
        if (state === "playing") {
          dispatchIntent({ type: "PAUSE" }, { sync: matchSync });
        } else if (state === "paused") {
          dispatchIntent({ type: "RESUME" }, { sync: matchSync });
        } else {
          controlsOverlay.toggle();
        }
      },
    },
    { sync: matchSync, keyboard: true },
  );
}
