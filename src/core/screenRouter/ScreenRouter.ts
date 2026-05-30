import type { GameStore } from "@core/gameStore";
import type { GameContext, GameStateValue, MachineSnapshot } from "@core/gameMachine.types";

/**
 * Interface minimale qu'un écran doit exposer pour être monté/démonté par
 * le routeur. Une seule méthode : `stop()` (cleanup DOM + listeners + WS).
 *
 * Le DOM, l'abonnement au store, la connexion WS, etc. sont à la charge
 * de l'écran lui-même au moment de la création par la factory.
 */
export interface ScreenInstance {
  stop(): void;
}

/**
 * Factory d'écran : reçoit l'hôte DOM et le contexte SM courant, retourne
 * une instance déjà montée. Le routeur ne fait rien d'autre qu'appeler la
 * factory et stocker l'instance pour la stopper à la transition suivante.
 */
export type ScreenFactory = (host: HTMLElement, ctx: GameContext) => ScreenInstance;

/** Map partielle état SM → factory. Si null/absent, aucun écran à monter. */
export type ScreenFactoryMap = Partial<Record<GameStateValue, ScreenFactory>>;

/**
 * Subscribe au `gameStore` et orchestre le cycle de vie des écrans en
 * fonction de `state.value`. Une seule instance attendue par app (montée
 * dans `src/main.ts`).
 *
 * - À chaque changement de `state.value`, démonte l'écran courant puis
 *   monte le suivant via la factory correspondante.
 * - Si la factory est absente pour un état (ex: `playing`, où la 3D du
 *   playfield reste seule à l'écran), le routeur démonte juste l'écran
 *   précédent et n'en monte aucun.
 * - Si seule le contexte change (sans changement d'état), le routeur ne
 *   re-monte pas — c'est à l'écran de s'abonner au store s'il a besoin
 *   de réagir aux changements de contexte intra-état.
 */
export class ScreenRouter {
  private currentScreen: ScreenInstance | null = null;
  private currentState: GameStateValue | null = null;
  private unsubscribe: (() => void) | null = null;

  constructor(
    private readonly host: HTMLElement,
    private readonly store: GameStore,
    private readonly factories: ScreenFactoryMap,
  ) {}

  start(): void {
    if (this.unsubscribe) return; // idempotent
    this.unsubscribe = this.store.subscribe((snap) => this.onSnapshot(snap));
  }

  stop(): void {
    this.unsubscribe?.();
    this.unsubscribe = null;
    this.unmountCurrent();
    this.currentState = null;
  }

  private onSnapshot(snap: MachineSnapshot): void {
    if (snap.value === this.currentState) return;

    this.unmountCurrent();

    const factory = this.factories[snap.value];
    if (factory) {
      this.currentScreen = factory(this.host, snap.context);
    }
    this.currentState = snap.value;
  }

  private unmountCurrent(): void {
    if (!this.currentScreen) return;
    try {
      this.currentScreen.stop();
    } catch (err) {
      // On log mais on ne propage pas : un écran qui plante au démontage
      // ne doit pas bloquer la transition vers le suivant.
      console.error("[ScreenRouter] erreur au démontage de l'écran", err);
    }
    this.currentScreen = null;
  }
}
