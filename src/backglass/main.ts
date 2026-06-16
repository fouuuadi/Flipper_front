import "../styles/global.css";

import { gameStore } from "@core/gameStore";
import { KeyboardDispatcher } from "@core/keyboardDispatcher";
import { ScreenRouter, type ScreenFactoryMap } from "@core/screenRouter";
import { matchSync } from "@services/matchSync";

import { BackglassApp } from "@modules/backglass";
import { CosmeticsStore } from "@modules/cosmetics";
import { Identification } from "@modules/identification";
import { Leaderboard } from "@modules/leaderboard";
import { Menu } from "@modules/menu";
import { Settings } from "@modules/settings";
import { Splash } from "@modules/splash";

const host = document.querySelector<HTMLDivElement>("#app");

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
  playing: (screenHost, context) => {
    const app = new BackglassApp(screenHost);
    app.start(context.sessionId);
    return { stop: () => app.stop() };
  },
};

if (host) {
  new KeyboardDispatcher({ store: gameStore, sync: matchSync }).start();
  new ScreenRouter(host, gameStore, factories).start();
}
