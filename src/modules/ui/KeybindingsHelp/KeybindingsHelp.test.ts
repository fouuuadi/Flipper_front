import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createGameStore } from "@core/gameStore";
import { helpModalState } from "@core/keyboardDispatcher";

import { KeybindingsHelp } from "./KeybindingsHelp";

/** EventTarget léger sans dépendance jsdom (cf. KeyboardDispatcher.test.ts). */
class FakeEventTarget implements EventTarget {
  private listeners: Map<string, Set<EventListenerOrEventListenerObject>> = new Map();
  addEventListener(type: string, listener: EventListenerOrEventListenerObject | null): void {
    if (!listener) return;
    const set = this.listeners.get(type) ?? new Set();
    set.add(listener);
    this.listeners.set(type, set);
  }
  removeEventListener(type: string, listener: EventListenerOrEventListenerObject | null): void {
    if (!listener) return;
    this.listeners.get(type)?.delete(listener);
  }
  dispatchEvent(event: Event): boolean {
    this.listeners.get(event.type)?.forEach((l) => {
      if (typeof l === "function") l.call(this, event);
      else l.handleEvent(event);
    });
    return !event.defaultPrevented;
  }
  listenerCount(type: string): number {
    return this.listeners.get(type)?.size ?? 0;
  }
}

/**
 * Faux Element minimal : la modal manipule des nodes via createElement /
 * appendChild / setAttribute / innerHTML / textContent / remove. On expose
 * uniquement ce qui est appelé, sans simuler le rendu réel.
 */
function fakeElement(tag: string): HTMLElement {
  const el: Record<string, unknown> = {
    tagName: tag.toUpperCase(),
    children: [] as unknown[],
    attributes: {} as Record<string, string>,
    className: "",
    id: "",
    textContent: "",
    innerHTML: "",
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
  const fakeDoc = {
    body,
    createElement: (tag: string) => fakeElement(tag),
    createDocumentFragment: () => {
      const frag: Record<string, unknown> = {
        children: [] as unknown[],
        appendChild(child: unknown) {
          (frag.children as unknown[]).push(child);
          return child;
        },
      };
      return frag as unknown as DocumentFragment;
    },
  };
  vi.stubGlobal("document", fakeDoc);
  return { body };
}

function fakeKey(key: string, opts: { fromInput?: boolean } = {}): Event {
  const target = opts.fromInput ? { tagName: "INPUT" } : null;
  return {
    type: "keydown",
    key,
    target,
    defaultPrevented: false,
    preventDefault() {
      (this as { defaultPrevented: boolean }).defaultPrevented = true;
    },
  } as unknown as Event;
}

describe("KeybindingsHelp", () => {
  beforeEach(() => {
    helpModalState.__reset();
    stubDocument();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("ne fait rien tant que start() n'a pas été appelé", () => {
    const target = new FakeEventTarget();
    const store = createGameStore();
    new KeybindingsHelp({ store, target });

    target.dispatchEvent(fakeKey("?"));
    expect(helpModalState.isOpen()).toBe(false);
  });

  it("`?` ouvre la modal et synchronise helpModalState", () => {
    const target = new FakeEventTarget();
    const store = createGameStore();
    const modal = new KeybindingsHelp({ store, target });
    modal.start();

    target.dispatchEvent(fakeKey("?"));

    expect(modal.isOpen()).toBe(true);
    expect(helpModalState.isOpen()).toBe(true);
  });

  it("`?` quand ouverte la ferme (toggle)", () => {
    const target = new FakeEventTarget();
    const store = createGameStore();
    const modal = new KeybindingsHelp({ store, target });
    modal.start();

    target.dispatchEvent(fakeKey("?"));
    target.dispatchEvent(fakeKey("?"));

    expect(modal.isOpen()).toBe(false);
    expect(helpModalState.isOpen()).toBe(false);
  });

  it("Escape ferme la modal quand elle est ouverte", () => {
    const target = new FakeEventTarget();
    const store = createGameStore();
    const modal = new KeybindingsHelp({ store, target });
    modal.start();
    modal.open();

    target.dispatchEvent(fakeKey("Escape"));

    expect(modal.isOpen()).toBe(false);
  });

  it("Escape n'affecte pas la modal quand elle est fermée (laisse passer au dispatcher)", () => {
    const target = new FakeEventTarget();
    const store = createGameStore();
    const modal = new KeybindingsHelp({ store, target });
    modal.start();

    const event = fakeKey("Escape");
    target.dispatchEvent(event);

    expect(modal.isOpen()).toBe(false);
    expect(event.defaultPrevented).toBe(false);
  });

  it("`?` dans un <input> est ignoré (l'utilisateur saisit un caractère)", () => {
    const target = new FakeEventTarget();
    const store = createGameStore();
    const modal = new KeybindingsHelp({ store, target });
    modal.start();

    target.dispatchEvent(fakeKey("?", { fromInput: true }));

    expect(modal.isOpen()).toBe(false);
  });

  it("stop() retire le listener et ferme la modal si ouverte", () => {
    const target = new FakeEventTarget();
    const store = createGameStore();
    const modal = new KeybindingsHelp({ store, target });
    modal.start();
    modal.open();
    expect(modal.isOpen()).toBe(true);

    modal.stop();

    expect(modal.isOpen()).toBe(false);
    expect(helpModalState.isOpen()).toBe(false);
    expect(target.listenerCount("keydown")).toBe(0);
  });

  it("open() puis close() programmatiquement marche aussi", () => {
    const target = new FakeEventTarget();
    const store = createGameStore();
    const modal = new KeybindingsHelp({ store, target });

    modal.open();
    expect(modal.isOpen()).toBe(true);
    expect(helpModalState.isOpen()).toBe(true);

    modal.close();
    expect(modal.isOpen()).toBe(false);
    expect(helpModalState.isOpen()).toBe(false);
  });

  it("open() est idempotent (pas de double mount)", () => {
    const target = new FakeEventTarget();
    const store = createGameStore();
    const modal = new KeybindingsHelp({ store, target });

    modal.open();
    modal.open();

    expect(modal.isOpen()).toBe(true);
  });
});
