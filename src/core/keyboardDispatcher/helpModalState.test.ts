import { beforeEach, describe, expect, it, vi } from "vitest";

import { helpModalState } from "./helpModalState";

describe("helpModalState", () => {
  beforeEach(() => {
    helpModalState.__reset();
  });

  it("démarre fermé", () => {
    expect(helpModalState.isOpen()).toBe(false);
  });

  it("open() / close() basculent l'état", () => {
    helpModalState.open();
    expect(helpModalState.isOpen()).toBe(true);
    helpModalState.close();
    expect(helpModalState.isOpen()).toBe(false);
  });

  describe("subscribe", () => {
    it("notifie le listener sur transition fermé → ouvert", () => {
      const listener = vi.fn();
      helpModalState.subscribe(listener);
      helpModalState.open();
      expect(listener).toHaveBeenCalledTimes(1);
    });

    it("notifie sur ouvert → fermé", () => {
      const listener = vi.fn();
      helpModalState.open();
      helpModalState.subscribe(listener);
      helpModalState.close();
      expect(listener).toHaveBeenCalledTimes(1);
    });

    it("n'invoque PAS le listener immédiatement au subscribe", () => {
      const listener = vi.fn();
      helpModalState.subscribe(listener);
      expect(listener).not.toHaveBeenCalled();
    });

    it("ne notifie pas si open() est appelé alors qu'on est déjà ouvert (no-op)", () => {
      const listener = vi.fn();
      helpModalState.subscribe(listener);
      helpModalState.open();
      helpModalState.open();
      helpModalState.open();
      expect(listener).toHaveBeenCalledTimes(1);
    });

    it("ne notifie pas si close() est appelé alors qu'on est déjà fermé", () => {
      const listener = vi.fn();
      helpModalState.subscribe(listener);
      helpModalState.close();
      expect(listener).not.toHaveBeenCalled();
    });

    it("retourne un disposer qui désabonne", () => {
      const listener = vi.fn();
      const unsubscribe = helpModalState.subscribe(listener);

      helpModalState.open();
      expect(listener).toHaveBeenCalledTimes(1);

      unsubscribe();
      helpModalState.close();
      expect(listener).toHaveBeenCalledTimes(1); // pas de nouvelle notif
    });

    it("supporte plusieurs listeners en parallèle", () => {
      const a = vi.fn();
      const b = vi.fn();
      helpModalState.subscribe(a);
      helpModalState.subscribe(b);

      helpModalState.open();

      expect(a).toHaveBeenCalledTimes(1);
      expect(b).toHaveBeenCalledTimes(1);
    });

    it("__reset() purge les listeners (pas de fuite entre tests)", () => {
      const listener = vi.fn();
      helpModalState.subscribe(listener);
      helpModalState.__reset();
      helpModalState.open();
      expect(listener).not.toHaveBeenCalled();
    });
  });
});
