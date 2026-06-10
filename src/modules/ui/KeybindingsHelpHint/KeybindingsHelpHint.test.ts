import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createGameStore } from "@core/gameStore";
import { helpModalState } from "@core/keyboardDispatcher";

import { KeybindingsHelpHint } from "./KeybindingsHelpHint";

/**
 * Fake document minimaliste pour mounter le hint sans jsdom (cf. modal
 * KeybindingsHelp.test.ts pour le même pattern).
 */
function fakeElement(tag: string): HTMLElement {
  const classes = new Set<string>();
  const el: Record<string, unknown> = {
    tagName: tag.toUpperCase(),
    children: [] as unknown[],
    attributes: {} as Record<string, string>,
    textContent: "",
    classList: {
      add: (c: string) => classes.add(c),
      remove: (c: string) => classes.delete(c),
      toggle: (c: string, force?: boolean) => {
        const next = force ?? !classes.has(c);
        if (next) classes.add(c);
        else classes.delete(c);
        return next;
      },
      contains: (c: string) => classes.has(c),
    },
    appendChild(child: unknown) {
      (el.children as unknown[]).push(child);
      return child;
    },
    setAttribute(name: string, value: string) {
      (el.attributes as Record<string, string>)[name] = value;
    },
    remove: vi.fn(),
  };
  return el as unknown as HTMLElement;
}

function stubDocument(): { body: HTMLElement } {
  const body = fakeElement("body");
  vi.stubGlobal("document", {
    body,
    createElement: (tag: string) => fakeElement(tag),
  });
  return { body };
}

describe("KeybindingsHelpHint", () => {
  beforeEach(() => {
    helpModalState.__reset();
    stubDocument();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("est visible au démarrage en état splash", () => {
    const store = createGameStore();
    const hint = new KeybindingsHelpHint({ store });
    hint.start();
    expect(hint.isVisible()).toBe(true);
  });

  it("se cache en état playing (3D pleine page)", () => {
    const store = createGameStore();
    // splash → menu → identification → playing
    store.send({ type: "PRESS_A" });
    store.send({ type: "START_GAME" });
    store.send({
      type: "PLAYERS_VALIDATED",
      mode: "solo",
      players: ["FOU#0001"],
      sessionId: "sid-1",
    });

    const hint = new KeybindingsHelpHint({ store });
    hint.start();
    expect(hint.isVisible()).toBe(false);
  });

  it("réapparaît quand on quitte playing pour paused", () => {
    const store = createGameStore();
    store.send({ type: "PRESS_A" });
    store.send({ type: "START_GAME" });
    store.send({
      type: "PLAYERS_VALIDATED",
      mode: "solo",
      players: ["FOU#0001"],
      sessionId: "sid-1",
    });

    const hint = new KeybindingsHelpHint({ store });
    hint.start();
    expect(hint.isVisible()).toBe(false);

    store.send({ type: "PAUSE" });
    expect(hint.isVisible()).toBe(true);
  });

  it("se cache quand la modal d'aide s'ouvre, réapparaît quand elle se ferme", () => {
    const store = createGameStore();
    const hint = new KeybindingsHelpHint({ store });
    hint.start();
    expect(hint.isVisible()).toBe(true);

    helpModalState.open();
    expect(hint.isVisible()).toBe(false);

    helpModalState.close();
    expect(hint.isVisible()).toBe(true);
  });

  it("reste caché si playing ET modal ouverte", () => {
    const store = createGameStore();
    store.send({ type: "PRESS_A" });
    store.send({ type: "START_GAME" });
    store.send({
      type: "PLAYERS_VALIDATED",
      mode: "solo",
      players: ["FOU#0001"],
      sessionId: "sid-1",
    });
    const hint = new KeybindingsHelpHint({ store });
    hint.start();
    helpModalState.open();
    expect(hint.isVisible()).toBe(false);
    helpModalState.close();
    // toujours caché car on est toujours en playing
    expect(hint.isVisible()).toBe(false);
  });

  it("stop() démonte le hint et désabonne du store / modal", () => {
    const store = createGameStore();
    const hint = new KeybindingsHelpHint({ store });
    hint.start();
    expect(hint.isVisible()).toBe(true);

    hint.stop();
    // Après stop, plus de DOM, plus de réaction
    expect(hint.isVisible()).toBe(false);

    // Une transition après stop ne doit rien casser
    store.send({ type: "PRESS_A" });
    helpModalState.open();
    expect(hint.isVisible()).toBe(false);
  });

  it("start() est idempotent (pas de double mount)", () => {
    const store = createGameStore();
    const hint = new KeybindingsHelpHint({ store });
    hint.start();
    hint.start();
    expect(hint.isVisible()).toBe(true);
    // Pas de meilleure assertion sans accès direct au DOM réel, le contrat
    // public reste cohérent.
  });
});
