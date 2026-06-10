import type { MatchSyncAdapter } from "@services/matchSync";
import "./countdown.css";

const FINAL_LABEL = "GO";

/**
 * Overlay countdown 3 → 2 → 1 → GO piloté par les events `countdown:tick`
 * reçus du back via `matchSync`. Auto-démontage 700 ms après le tick `0`,
 * laissant le canvas 3D / HUD visibles dès que `match:state: playing` arrive.
 *
 * S'instancie via `attachCountdownOverlay(matchSync)` qui retourne un
 * disposer — le routeur appellera ça au démarrage de l'app et le laissera
 * tourner toute la session (un seul listener réutilisé pour tous les
 * countdowns à venir).
 */
export class Countdown {
  private readonly host: HTMLElement;
  private root: HTMLElement | null = null;
  private valueEl: HTMLElement | null = null;
  private hideTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(host: HTMLElement = document.body) {
    this.host = host;
  }

  showTick(value: number): void {
    if (this.hideTimer) {
      clearTimeout(this.hideTimer);
      this.hideTimer = null;
    }
    if (!this.root || !this.valueEl) {
      this.mount();
    }
    if (this.valueEl) {
      this.valueEl.textContent = value === 0 ? FINAL_LABEL : String(value);
      this.valueEl.classList.remove("countdown-value--pulse");
      // Force un reflow pour que l'animation se rejoue à chaque tick.
      void this.valueEl.offsetWidth;
      this.valueEl.classList.add("countdown-value--pulse");
    }
    if (value === 0) {
      this.hideTimer = setTimeout(() => this.dismiss(), 700);
    }
  }

  dismiss(): void {
    if (this.hideTimer) {
      clearTimeout(this.hideTimer);
      this.hideTimer = null;
    }
    if (this.root) {
      this.root.remove();
      this.root = null;
      this.valueEl = null;
    }
  }

  private mount(): void {
    this.root = document.createElement("section");
    this.root.className = "countdown-scene";
    this.root.setAttribute("aria-live", "assertive");
    this.valueEl = document.createElement("div");
    this.valueEl.className = "countdown-value";
    this.root.appendChild(this.valueEl);
    this.host.appendChild(this.root);
  }
}

/**
 * Branche un `Countdown` sur les events `countdown:tick` de l'adapter.
 * @returns un disposer qui dégonfle le listener et démonte l'overlay s'il
 *          est encore monté.
 */
export function attachCountdownOverlay(
  sync: MatchSyncAdapter,
  host: HTMLElement = document.body,
): () => void {
  const countdown = new Countdown(host);
  const unsubscribe = sync.onEvent((event) => {
    if (event.type !== "countdown:tick") return;
    countdown.showTick(event.value);
  });
  return () => {
    unsubscribe();
    countdown.dismiss();
  };
}
