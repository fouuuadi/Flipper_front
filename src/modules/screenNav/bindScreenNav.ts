import type { MatchSyncAdapter, NavButton } from "@services/matchSync";

export type NavHandlers = Partial<Record<NavButton, () => void>>;

export interface BindScreenNavOptions {
  readonly sync: Pick<MatchSyncAdapter, "onEvent">;
  /** Écoute aussi les flèches clavier en dev (← → = left/right). */
  readonly keyboard?: boolean;
  readonly target?: EventTarget;
}

// Touches dev mappées vers un bouton de nav. Volontairement limité aux flèches :
// les raccourcis directs (Entrée, l, b, p…) restent gérés par le KeyboardDispatcher
// existant, donc aucun conflit. En prod, c'est `control:nav` qui pilote tout.
const KEY_TO_NAV: Readonly<Record<string, NavButton>> = {
  ArrowLeft: "left",
  ArrowRight: "right",
};

/**
 * Branche les entrées de navigation d'un écran sur des handlers, depuis deux
 * sources interchangeables :
 *   - **borne** : les events `control:nav` relayés par le backend (boutons ESP32),
 *   - **clavier (dev)** : les flèches ← →, si `keyboard: true`.
 *
 * L'écran fournit ses handlers (`confirm`, `left`, `right`, `back`, `help`) ; il
 * ne sait pas d'où vient l'appui. Retourne un cleanup.
 */
export function bindScreenNav(
  handlers: NavHandlers,
  options: BindScreenNavOptions,
): () => void {
  const { sync, keyboard = false } = options;
  const cleanups: Array<() => void> = [];

  cleanups.push(
    sync.onEvent((event) => {
      if (event.type === "control:nav") handlers[event.button]?.();
    }),
  );

  if (keyboard) {
    const target = options.target ?? window;
    const onKey = (event: Event): void => {
      const button = KEY_TO_NAV[(event as KeyboardEvent).code];
      if (button) handlers[button]?.();
    };
    target.addEventListener("keydown", onKey);
    cleanups.push(() => target.removeEventListener("keydown", onKey));
  }

  return () => {
    for (const cleanup of cleanups) cleanup();
  };
}
