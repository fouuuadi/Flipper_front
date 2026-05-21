import "./splash.css";

const SPLASH_TEMPLATE = `
  <div class="stars" aria-hidden="true"></div>

  <div class="planet planet-orange" aria-hidden="true"></div>
  <div class="planet planet-pink" aria-hidden="true"></div>
  <div class="planet planet-blue" aria-hidden="true"></div>
  <div class="planet planet-purple" aria-hidden="true"></div>
  <div class="planet planet-cyan" aria-hidden="true"></div>

  <div class="title">
    <div class="word mario">
      <span class="letter letter-m">M</span>
      <span class="letter letter-a-mario">A</span>
      <span class="letter letter-r">R</span>
      <span class="letter letter-i">I</span>
      <span class="letter letter-o">O</span>
    </div>
    <div class="word galaxy">
      <span class="letter letter-g">G</span>
      <span class="letter letter-a-galaxy">A</span>
      <span class="letter letter-l">L</span>
      <span class="letter letter-a-galaxy">A</span>
      <span class="letter letter-x">X</span>
      <span class="letter letter-y">Y</span>
    </div>
    <div class="word pinball">
      <span class="neon-pinball">PINBALL</span>
    </div>
  </div>

  <div class="prompt" aria-hidden="true">
    Appuyer sur <span class="prompt-button">A</span>
  </div>
`;

const TRIGGER_KEYS = new Set(["a", "A", "Enter", " "]);
const EXIT_TRANSITION_MS = 400;

/**
 * Écran d'accueil "PRESS A".
 * À remplacer par un event `PRESS_A` émis vers la state machine quand l'issue #80 sera implémentée.
 */
export class Splash {
  private readonly host: HTMLElement;
  private root: HTMLElement | null = null;
  private keyHandler: ((event: KeyboardEvent) => void) | null = null;
  private resolveStart: (() => void) | null = null;

  constructor(host: HTMLElement = document.body) {
    this.host = host;
  }

  /**
   * Monte l'écran et attend le premier appui sur A/Enter/Space.
   * La Promise se résout après l'animation de sortie (le splash est démonté à ce moment).
   */
  start(): Promise<void> {
    if (this.root) {
      throw new Error("Splash already mounted");
    }

    this.root = document.createElement("main");
    this.root.className = "splash-scene";
    this.root.innerHTML = SPLASH_TEMPLATE;
    this.host.appendChild(this.root);

    return new Promise((resolve) => {
      this.resolveStart = resolve;
      this.keyHandler = (event) => {
        if (TRIGGER_KEYS.has(event.key)) {
          event.preventDefault();
          this.dismiss();
        }
      };
      window.addEventListener("keydown", this.keyHandler);
    });
  }

  /**
   * Démonte le splash manuellement (sans attendre l'input utilisateur).
   * Utile pour les tests ou un cleanup d'urgence.
   */
  dismiss(): void {
    if (!this.root || !this.keyHandler) {
      return;
    }

    window.removeEventListener("keydown", this.keyHandler);
    this.keyHandler = null;

    this.root.classList.add("splash-scene--exiting");

    const root = this.root;
    const resolve = this.resolveStart;
    this.root = null;
    this.resolveStart = null;

    window.setTimeout(() => {
      root.remove();
      resolve?.();
    }, EXIT_TRANSITION_MS);
  }
}
