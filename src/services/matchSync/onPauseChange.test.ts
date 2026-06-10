import { describe, expect, it, vi } from "vitest";

import { MatchSyncAdapter } from "./MatchSyncAdapter";
import type { WsServerEvent } from "./protocol";
import { onPauseChange } from "./onPauseChange";

/**
 * Adapter de test : remplace la WebSocket par un EventBus interne pour
 * pouvoir simuler `match:state` à la demande, sans monter de vraie socket.
 */
function makeFakeSync() {
  // On instancie un vrai MatchSyncAdapter avec un faux socketFactory pour
  // bénéficier de la logique onEvent. On n'a pas besoin d'ouvrir la socket :
  // on tape directement sur les listeners via dispatch interne.
  const adapter = new MatchSyncAdapter({
    socketFactory: () => ({}) as unknown as WebSocket,
  });

  // Helper pour envoyer un event WS comme s'il venait du back.
  const emit = (event: WsServerEvent) => {
    // Accède au state interne (typesafe-bypass pour le test) — alternative
    // serait d'ouvrir une vraie WS, mais ça déborde du scope unit.
    const listeners = (adapter as unknown as { listeners: Set<(e: WsServerEvent) => void> })
      .listeners;
    listeners.forEach((l) => l(event));
  };

  return { adapter, emit };
}

describe("onPauseChange", () => {
  it("notifie isPaused=true à l'arrivée de match:state: paused", () => {
    const { adapter, emit } = makeFakeSync();
    const handler = vi.fn();
    onPauseChange(adapter, handler);

    emit({ type: "match:state", status: "paused", sessionId: "sid" });

    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler).toHaveBeenCalledWith(true);
  });

  it("notifie isPaused=false à l'arrivée de match:state: playing", () => {
    const { adapter, emit } = makeFakeSync();
    const handler = vi.fn();
    onPauseChange(adapter, handler);

    emit({ type: "match:state", status: "paused", sessionId: "sid" });
    emit({ type: "match:state", status: "playing", sessionId: "sid" });

    expect(handler).toHaveBeenNthCalledWith(1, true);
    expect(handler).toHaveBeenNthCalledWith(2, false);
  });

  it("notifie isPaused=false aussi sur ready/over/waiting", () => {
    const { adapter, emit } = makeFakeSync();
    const handler = vi.fn();
    onPauseChange(adapter, handler);

    emit({ type: "match:state", status: "paused", sessionId: "sid" });
    emit({ type: "match:state", status: "over", sessionId: "sid" });
    expect(handler).toHaveBeenLastCalledWith(false);
  });

  it("dédup : un même statut consécutif n'est notifié qu'une fois", () => {
    const { adapter, emit } = makeFakeSync();
    const handler = vi.fn();
    onPauseChange(adapter, handler);

    emit({ type: "match:state", status: "paused", sessionId: "sid" });
    emit({ type: "match:state", status: "paused", sessionId: "sid" });
    emit({ type: "match:state", status: "paused", sessionId: "sid" });

    expect(handler).toHaveBeenCalledTimes(1);
  });

  it("notifie la 1re valeur reçue, puis chaque transition (état initial = inconnu)", () => {
    const { adapter, emit } = makeFakeSync();
    const handler = vi.fn();
    onPauseChange(adapter, handler);

    emit({ type: "match:state", status: "playing", sessionId: "sid" });
    // 1re valeur → notif (false), permet au consommateur d'aligner son état
    expect(handler).toHaveBeenNthCalledWith(1, false);

    emit({ type: "match:state", status: "paused", sessionId: "sid" });
    expect(handler).toHaveBeenNthCalledWith(2, true);

    emit({ type: "match:state", status: "paused", sessionId: "sid" });
    // dédup : pas de 3e notif
    expect(handler).toHaveBeenCalledTimes(2);
  });

  it("ignore les events non-match:state (score:update, countdown:tick…)", () => {
    const { adapter, emit } = makeFakeSync();
    const handler = vi.fn();
    onPauseChange(adapter, handler);

    emit({ type: "score:update", score: 100, combo: 1 });
    emit({ type: "countdown:tick", value: 2 });
    emit({ type: "ball:lost", livesRemaining: 2 });
    emit({ type: "game:over", finalScore: 1000 });

    expect(handler).not.toHaveBeenCalled();
  });

  it("désabonne via le disposer", () => {
    const { adapter, emit } = makeFakeSync();
    const handler = vi.fn();
    const unsubscribe = onPauseChange(adapter, handler);

    unsubscribe();
    emit({ type: "match:state", status: "paused", sessionId: "sid" });

    expect(handler).not.toHaveBeenCalled();
  });
});
