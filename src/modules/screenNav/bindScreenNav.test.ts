import { describe, expect, it, vi } from "vitest";

import { bindScreenNav } from "./bindScreenNav";
import type { MatchSyncAdapter, WsServerEvent, NavButton } from "@services/matchSync";

function makeSync() {
  let handler: ((event: WsServerEvent) => void) | null = null;
  const sync: Pick<MatchSyncAdapter, "onEvent"> = {
    onEvent: (h) => {
      handler = h;
      return () => {
        handler = null;
      };
    },
  };
  return { sync, emitNav: (button: NavButton) => handler?.({ type: "control:nav", button }) };
}

function keyEvent(code: string): Event {
  const event = new Event("keydown");
  (event as { code?: string }).code = code;
  return event;
}

describe("bindScreenNav", () => {
  it("route les control:nav de la borne vers les handlers", () => {
    const { sync, emitNav } = makeSync();
    const confirm = vi.fn();
    const left = vi.fn();
    bindScreenNav({ confirm, left }, { sync });

    emitNav("confirm");
    emitNav("left");
    emitNav("right"); // pas de handler → ignoré sans erreur

    expect(confirm).toHaveBeenCalledTimes(1);
    expect(left).toHaveBeenCalledTimes(1);
  });

  it("mappe les flèches clavier quand keyboard est activé", () => {
    const { sync } = makeSync();
    const left = vi.fn();
    const right = vi.fn();
    const target = new EventTarget();
    bindScreenNav({ left, right }, { sync, keyboard: true, target });

    target.dispatchEvent(keyEvent("ArrowLeft"));
    target.dispatchEvent(keyEvent("ArrowRight"));

    expect(left).toHaveBeenCalledTimes(1);
    expect(right).toHaveBeenCalledTimes(1);
  });

  it("ignore le clavier quand keyboard est désactivé", () => {
    const { sync } = makeSync();
    const left = vi.fn();
    const target = new EventTarget();
    bindScreenNav({ left }, { sync, target });

    target.dispatchEvent(keyEvent("ArrowLeft"));

    expect(left).not.toHaveBeenCalled();
  });

  it("le cleanup se désabonne du bus et du clavier", () => {
    const { sync, emitNav } = makeSync();
    const confirm = vi.fn();
    const left = vi.fn();
    const target = new EventTarget();
    const dispose = bindScreenNav({ confirm, left }, { sync, keyboard: true, target });

    dispose();
    emitNav("confirm");
    target.dispatchEvent(keyEvent("ArrowLeft"));

    expect(confirm).not.toHaveBeenCalled();
    expect(left).not.toHaveBeenCalled();
  });
});
