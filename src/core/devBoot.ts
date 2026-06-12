import type { GameStore } from "./gameStore";

/**
 * Bypass de développement : atterrit directement sur un état avancé de la SM
 * via `?boot=<state>`, sans dérouler le flow d'écrans à la main.
 *
 * Dev-only (gardé derrière import.meta.env.DEV → éliminé du bundle prod).
 * Atteint l'état cible via des transitions SM légitimes uniquement : pas de
 * mutation directe du contexte.
 */
export function applyDevBoot(store: GameStore): void {
  if (!import.meta.env.DEV) return;
  const boot = new URLSearchParams(window.location.search).get("boot");
  if (!boot) return;

  switch (boot) {
    case "playing":
      store.send({ type: "PRESS_A" }); // splash → menu
      store.send({ type: "START_GAME" }); // menu → identification
      store.send({
        // identification → playing
        type: "PLAYERS_VALIDATED",
        mode: "solo",
        players: ["DEV#0001"],
        sessionId: null,
      });
      break;
    default:
      console.warn(`[devBoot] valeur "boot=${boot}" inconnue — ignorée`);
  }
}
