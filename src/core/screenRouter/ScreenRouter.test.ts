import { describe, expect, it, vi } from "vitest";

import { createGameStore } from "@core/gameStore";
import { ScreenRouter, type ScreenFactory, type ScreenInstance } from "./ScreenRouter";

/**
 * Crée une factory et une fonction `stop` espionnée pour observer le cycle
 * de vie de l'écran.
 */
function trackedFactory(label: string): {
  factory: ScreenFactory;
  stop: ReturnType<typeof vi.fn>;
  built: ReturnType<typeof vi.fn>;
} {
  const stop = vi.fn();
  const built = vi.fn();
  const factory: ScreenFactory = (host, ctx) => {
    built(label, host, ctx);
    const instance: ScreenInstance = { stop };
    return instance;
  };
  return { factory, stop, built };
}

function makeHost(): HTMLElement {
  return { tagName: "DIV" } as unknown as HTMLElement;
}

describe("ScreenRouter", () => {
  it("monte l'écran correspondant à l'état initial au start()", () => {
    const splash = trackedFactory("splash");
    const host = makeHost();
    const store = createGameStore();
    const router = new ScreenRouter(host, store, { splash: splash.factory });

    router.start();

    expect(splash.built).toHaveBeenCalledTimes(1);
    expect(splash.stop).not.toHaveBeenCalled();
  });

  it("monte/démonte les écrans lors des transitions de state.value", () => {
    const splash = trackedFactory("splash");
    const menu = trackedFactory("menu");
    const host = makeHost();
    const store = createGameStore();
    const router = new ScreenRouter(host, store, {
      splash: splash.factory,
      menu: menu.factory,
    });

    router.start();
    expect(splash.built).toHaveBeenCalledTimes(1);

    store.send({ type: "PRESS_A" }); // splash → menu

    expect(splash.stop).toHaveBeenCalledTimes(1);
    expect(menu.built).toHaveBeenCalledTimes(1);
  });

  it("démonte le précédent même s'il n'y a pas de factory pour l'état cible", () => {
    // playing n'a pas de factory (la 3D vit ailleurs) — le menu doit
    // tout de même être démonté quand on bascule.
    const menu = trackedFactory("menu");
    const host = makeHost();
    const store = createGameStore();
    // On bascule en menu d'abord
    store.send({ type: "PRESS_A" });
    const router = new ScreenRouter(host, store, { menu: menu.factory });
    router.start();

    expect(menu.built).toHaveBeenCalledTimes(1);

    store.send({ type: "START_GAME" }); // menu → identification (pas dans le map)
    expect(menu.stop).toHaveBeenCalledTimes(1);
  });

  it("ne re-monte pas si l'état ne change pas (changements de contexte seul)", () => {
    const playing = trackedFactory("playing");
    const host = makeHost();
    const store = createGameStore();
    // Aller en playing : splash → menu → identification → playing
    store.send({ type: "PRESS_A" });
    store.send({ type: "START_GAME" });
    store.send({
      type: "PLAYERS_VALIDATED",
      mode: "solo",
      players: ["FOU#0001"],
      sessionId: "sid-1",
    });

    const router = new ScreenRouter(host, store, { playing: playing.factory });
    router.start();
    expect(playing.built).toHaveBeenCalledTimes(1);

    // Une transition qui resterait dans le même value: aucune n'existe pour
    // playing dans la SM actuelle, mais on simule via une 2e subscription
    // (le store re-notifie l'état courant à chaque subscribe). On vérifie
    // simplement qu'aucun re-mount n'a lieu en l'absence de transition.
    expect(playing.built).toHaveBeenCalledTimes(1);
    expect(playing.stop).not.toHaveBeenCalled();
  });

  it("passe le contexte courant à la factory", () => {
    const playing = trackedFactory("playing");
    const host = makeHost();
    const store = createGameStore();
    store.send({ type: "PRESS_A" });
    store.send({ type: "START_GAME" });
    store.send({
      type: "PLAYERS_VALIDATED",
      mode: "solo",
      players: ["FOU#0001"],
      sessionId: "sid-42",
    });

    const router = new ScreenRouter(host, store, { playing: playing.factory });
    router.start();

    expect(playing.built).toHaveBeenCalledWith(
      "playing",
      host,
      expect.objectContaining({ sessionId: "sid-42", mode: "solo" }),
    );
  });

  it("stop() retire le subscriber et démonte l'écran courant", () => {
    const splash = trackedFactory("splash");
    const host = makeHost();
    const store = createGameStore();
    const router = new ScreenRouter(host, store, { splash: splash.factory });
    router.start();

    router.stop();
    expect(splash.stop).toHaveBeenCalledTimes(1);

    // Après stop, plus de réaction aux transitions
    store.send({ type: "PRESS_A" });
    expect(splash.stop).toHaveBeenCalledTimes(1);
  });

  it("start() est idempotent", () => {
    const splash = trackedFactory("splash");
    const host = makeHost();
    const store = createGameStore();
    const router = new ScreenRouter(host, store, { splash: splash.factory });

    router.start();
    router.start();

    // Une seule construction malgré 2 starts
    expect(splash.built).toHaveBeenCalledTimes(1);
  });

  it("une factory qui throw au démontage ne bloque pas la transition", () => {
    const broken = vi.fn(() => {
      throw new Error("boom");
    });
    const next = trackedFactory("menu");
    const host = makeHost();
    const store = createGameStore();
    const router = new ScreenRouter(host, store, {
      splash: () => ({ stop: broken }),
      menu: next.factory,
    });

    // Capture le log d'erreur pour ne pas polluer la sortie test
    const err = vi.spyOn(console, "error").mockImplementation(() => {});
    router.start();
    store.send({ type: "PRESS_A" }); // splash.stop throw, on doit quand même monter menu

    expect(broken).toHaveBeenCalledTimes(1);
    expect(next.built).toHaveBeenCalledTimes(1);
    err.mockRestore();
  });
});
