import { beforeEach, describe, expect, it, vi } from "vitest";

import type { GameStore } from "@core/gameStore";
import type { MachineSnapshot } from "@core/gameMachine.types";
import type { MatchSyncAdapter } from "@services/matchSync";

import { KeyboardDispatcher } from "./KeyboardDispatcher";
import { helpModalState } from "./helpModalState";

/**
 * EventTarget minimaliste : accepte des "events" qui sont juste des objets
 * `{ type, ...payload }`. Suffit pour tester le dispatcher sans dépendre
 * de jsdom (pas installé dans le projet, et vitest tourne en `node`).
 */
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
    const set = this.listeners.get(event.type);
    if (!set) return true;
    for (const l of set) {
      if (typeof l === "function") l.call(this, event);
      else l.handleEvent(event);
    }
    return !event.defaultPrevented;
  }
}

function snapshotIn(
  value: MachineSnapshot["value"],
  sessionId: string | null = null,
): MachineSnapshot {
  return {
    value,
    context: {
      mode: "solo",
      players: [],
      currentBall: 1,
      startedAt: null,
      sessionId,
      finalDurationMs: null,
    },
  };
}

interface MutableStore extends GameStore {
  __setState(next: MachineSnapshot): void;
}

function makeStore(initial: MachineSnapshot): MutableStore {
  let snap = initial;
  return {
    getState: () => snap,
    send: vi.fn(),
    applyServerState: vi.fn(),
    subscribe: () => () => {},
    __setState: (next) => {
      snap = next;
    },
  };
}

function makeSync(): MatchSyncAdapter {
  return {
    dispatch: vi.fn(),
    connect: vi.fn(),
    disconnect: vi.fn(),
    onEvent: vi.fn(() => () => {}),
  } as unknown as MatchSyncAdapter;
}

/**
 * Construit un faux KeyboardEvent. Le dispatcher accède à `key`, `target`
 * et `preventDefault()`. Pas besoin d'une vraie instance KeyboardEvent.
 */
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

describe("KeyboardDispatcher", () => {
  beforeEach(() => {
    helpModalState.__reset();
  });

  it("ne fait rien tant que start() n'a pas été appelé", () => {
    const target = new FakeEventTarget();
    const store = makeStore(snapshotIn("playing"));
    const sync = makeSync();
    new KeyboardDispatcher({ store, sync, target });

    target.dispatchEvent(fakeKey("Escape"));

    expect(store.send).not.toHaveBeenCalled();
    expect(sync.dispatch).not.toHaveBeenCalled();
  });

  it("PAUSE en playing → cmd:pause sur le bus borne, jamais le store", () => {
    const target = new FakeEventTarget();
    const store = makeStore(snapshotIn("playing"));
    const sync = makeSync();
    new KeyboardDispatcher({ store, sync, target }).start();

    target.dispatchEvent(fakeKey("Escape"));

    expect(sync.dispatch).toHaveBeenCalledWith({ type: "cmd:pause" });
    expect(store.send).not.toHaveBeenCalled();
  });

  it("RESUME en paused → cmd:resume", () => {
    const target = new FakeEventTarget();
    const store = makeStore(snapshotIn("paused"));
    const sync = makeSync();
    new KeyboardDispatcher({ store, sync, target }).start();

    target.dispatchEvent(fakeKey("Escape"));

    expect(sync.dispatch).toHaveBeenCalledWith({ type: "cmd:resume" });
    expect(store.send).not.toHaveBeenCalled();
  });

  it("matche le wildcard du splash : n'importe quelle touche → intent PRESS_A", () => {
    const target = new FakeEventTarget();
    const store = makeStore(snapshotIn("splash"));
    const sync = makeSync();
    new KeyboardDispatcher({ store, sync, target }).start();

    target.dispatchEvent(fakeKey("x"));
    target.dispatchEvent(fakeKey("Enter"));
    target.dispatchEvent(fakeKey(" "));

    expect(sync.dispatch).toHaveBeenCalledTimes(3);
    expect(sync.dispatch).toHaveBeenCalledWith({ type: "intent", action: "PRESS_A" });
    expect(store.send).not.toHaveBeenCalled();
  });

  it("ignore une touche qui n'a pas de binding pour l'état courant", () => {
    const target = new FakeEventTarget();
    const store = makeStore(snapshotIn("menu"));
    const sync = makeSync();
    new KeyboardDispatcher({ store, sync, target }).start();

    target.dispatchEvent(fakeKey("z")); // menu n'a que Enter et "l"

    expect(sync.dispatch).not.toHaveBeenCalled();
  });

  it("court-circuite tout quand la modal d'aide est ouverte", () => {
    const target = new FakeEventTarget();
    const store = makeStore(snapshotIn("paused"));
    const sync = makeSync();
    new KeyboardDispatcher({ store, sync, target }).start();

    helpModalState.open();
    target.dispatchEvent(fakeKey("a")); // ABANDON normalement

    expect(store.send).not.toHaveBeenCalled();
    expect(sync.dispatch).not.toHaveBeenCalled();
  });

  it("ignore un keydown qui cible un <input> (saisie texte)", () => {
    const target = new FakeEventTarget();
    const store = makeStore(snapshotIn("paused"));
    const sync = makeSync();
    new KeyboardDispatcher({ store, sync, target }).start();

    target.dispatchEvent(fakeKey("a", { fromInput: true }));

    expect(sync.dispatch).not.toHaveBeenCalled();
  });

  it("stop() retire le listener — plus aucun event ne passe", () => {
    const target = new FakeEventTarget();
    const store = makeStore(snapshotIn("playing"));
    const sync = makeSync();
    const d = new KeyboardDispatcher({ store, sync, target });
    d.start();
    d.stop();

    target.dispatchEvent(fakeKey("Escape"));

    expect(sync.dispatch).not.toHaveBeenCalled();
  });

  it("start() est idempotent (pas de double listener)", () => {
    const target = new FakeEventTarget();
    const store = makeStore(snapshotIn("playing"));
    const sync = makeSync();
    const d = new KeyboardDispatcher({ store, sync, target });
    d.start();
    d.start();

    target.dispatchEvent(fakeKey("Escape"));

    expect(sync.dispatch).toHaveBeenCalledTimes(1);
  });

  it("lit l'état SM à chaque keydown (pas figé au start)", () => {
    const target = new FakeEventTarget();
    const store = makeStore(snapshotIn("playing"));
    const sync = makeSync();
    new KeyboardDispatcher({ store, sync, target }).start();

    target.dispatchEvent(fakeKey("Escape")); // playing → cmd:pause
    store.__setState(snapshotIn("paused"));
    target.dispatchEvent(fakeKey("Escape")); // paused → cmd:resume

    expect(sync.dispatch).toHaveBeenNthCalledWith(1, { type: "cmd:pause" });
    expect(sync.dispatch).toHaveBeenNthCalledWith(2, { type: "cmd:resume" });
  });

  it("n'intercepte jamais `?` (réservé à la modal d'aide)", () => {
    const target = new FakeEventTarget();
    const store = makeStore(snapshotIn("splash")); // wildcard PRESS_A actif
    const sync = makeSync();
    new KeyboardDispatcher({ store, sync, target }).start();

    target.dispatchEvent(fakeKey("?"));

    expect(store.send).not.toHaveBeenCalled();
    expect(sync.dispatch).not.toHaveBeenCalled();
  });

  it("normalise les lettres en minuscule avant lookup", () => {
    const target = new FakeEventTarget();
    const store = makeStore(snapshotIn("paused"));
    const sync = makeSync();
    new KeyboardDispatcher({ store, sync, target }).start();

    target.dispatchEvent(fakeKey("A")); // ABANDON même en MAJ
    target.dispatchEvent(fakeKey("a"));

    expect(sync.dispatch).toHaveBeenCalledTimes(2);
    expect(sync.dispatch).toHaveBeenCalledWith({ type: "cmd:abandon" });
  });
});
