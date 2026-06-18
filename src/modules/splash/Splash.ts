import "./splash.css";
import { menuAudio } from "@services/menuAudio";

const SPLASH_TEMPLATE = `
  <div class="stars" aria-hidden="true"></div>

  <div class="planet planet-orange" aria-hidden="true"></div>
  <div class="planet planet-pink" aria-hidden="true"></div>
  <div class="planet planet-blue" aria-hidden="true"></div>
  <div class="planet planet-purple" aria-hidden="true"></div>
  <div class="planet planet-cyan" aria-hidden="true"></div>

  <div class="title">
    <div class="word mario">
      <span class="letter letter-m">H</span>
      <span class="letter letter-a-mario">E</span>
      <span class="letter letter-r">T</span>
      <span class="letter letter-i">I</span>
      <span class="letter letter-o">C</span>
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

const EXIT_TRANSITION_MS = 400;

/**
 * Écran d'accueil "PRESS A".
 *
 * Passif : pas de keyHandler local, pas de Promise — le `KeyboardDispatcher`
 * global dispatch `PRESS_A` sur n'importe quelle touche en état `splash`
 * (cf. `core/keyboardDispatcher/bindings.ts`), le `ScreenRouter` démonte
 * ensuite via `unmount()`.
 */
export class Splash {
  private root: HTMLElement | null = null;

  mount(host: HTMLElement = document.body): void {
    if (this.root) return;
    this.root = document.createElement("main");
    this.root.className = "splash-scene";
    this.root.innerHTML = SPLASH_TEMPLATE;
    host.appendChild(this.root);
    menuAudio.playSplash();
  }

  unmount(): void {
    if (!this.root) return;
    const root = this.root;
    this.root = null;
    // Animation de sortie 400 ms, puis remove (gardé pour préserver le
    // fondu visuel — l'écran suivant se monte par-dessus pendant la transition).
    root.classList.add("splash-scene--exiting");
    menuAudio.playMenu();
    window.setTimeout(() => root.remove(), EXIT_TRANSITION_MS);
  }
}
