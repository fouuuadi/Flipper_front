import "../styles/global.css";

import { applyDevBoot } from "@core/devBoot";
import { isDevLocalSyncEnabled } from "@core/devLocalSync";
import { gameStore } from "@core/gameStore";
import { KeyboardDispatcher } from "@core/keyboardDispatcher";
import { ScreenRouter, type ScreenFactory, type ScreenFactoryMap } from "@core/screenRouter";
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

const factories: ScreenFactoryMap = {
  splash: (screenHost) => {
    const splash = new Splash();
    splash.mount(screenHost);
    return { stop: () => splash.unmount() };
  },
  menu: (screenHost) => {
    const menu = new Menu();
    menu.mount(screenHost);
    return { stop: () => menu.unmount() };
  },
  identification: (screenHost) => {
    const identification = new Identification();
    identification.mount(screenHost);
    return { stop: () => identification.unmount() };
  },
  leaderboard: (screenHost) => {
    const leaderboard = new Leaderboard();
    leaderboard.mount(screenHost);
    return { stop: () => leaderboard.unmount() };
  },
  cosmetics: (screenHost) => {
    const cosmetics = new CosmeticsStore();
    cosmetics.mount(screenHost);
    return { stop: () => cosmetics.unmount() };
  },
  settings: (screenHost) => {
    const settings = new Settings();
    settings.mount(screenHost);
    return { stop: () => settings.unmount() };
  },
  playing: backglassHud,
  paused: backglassHud,
  gameOver: backglassHud,
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
}
