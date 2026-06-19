import type { MatchSyncAdapter, WsServerEvent } from "@services/matchSync";
import { DotMatrix } from "./dotMatrix";
import { textWidth } from "./font5x7";
import { BALL, COIN, COLOR, HEART, HEART_EMPTY, SPARKLE } from "./sprites";
import "./dmd.css";

/** Une scène dessine une frame du DMD à l'instant `t` */
type Scene = (m: DotMatrix, t: number) => void;

const ATTRACT_TEXT = "* MARIO DELUXE PINBALL *  INSERT COIN  ";
const MAX_LIVES = 3;

// ── Décorations réutilisables (toujours dans les marges) ─────────────

/** Étincelle qui clignote en 3 états (éteinte → point → étoile). */
function twinkle(m: DotMatrix, t: number, x: number, y: number, phase: number, color: number): void {
  const state = Math.floor(t / 250 + phase) % 3;
  if (state === 0) return;
  if (state === 1) m.setPixel(x, y, color);
  else m.blit(SPARKLE, x - 2, y - 2, 1, color);
}

/** Une étincelle dans chaque coin, déphasées. */
function cornerSparkles(m: DotMatrix, t: number, color: number = COLOR.yellow): void {
  twinkle(m, t, 4, 4, 0, color);
  twinkle(m, t, m.cols - 5, 4, 1, color);
  twinkle(m, t, 4, m.rows - 5, 2, color);
  twinkle(m, t, m.cols - 5, m.rows - 5, 1, color);
}

/** Pointillés animés en haut et en bas (effet "marquee lumineux"). */
function edgeDots(m: DotMatrix, t: number, color: number): void {
  const off = Math.floor(t / 120) % 4;
  for (let x = off; x < m.cols; x += 4) {
    m.setPixel(x, 0, color);
    m.setPixel(m.cols - 1 - x, m.rows - 1, color);
  }
}

// ── Fabriques de scènes ──────────────────────────────────────────────

function marquee(text: string, color: number): Scene {
  const w = textWidth(text);
  return (m, t) => {
    const period = w + 140;
    const x = m.cols - ((t * 0.035) % period);
    m.drawText(text, color, Math.round(x), 12);
    cornerSparkles(m, t);
    edgeDots(m, t, COLOR.red);
  };
}

function coinBanner(text: string, color: number): Scene {
  return (m, t) => {
    const frame = COIN[Math.floor(t / 110) % COIN.length];
    m.blit(frame, 6, 12);
    m.blit(frame, m.cols - 14, 12);
    m.drawCentered(text, color, 1, 12);
    cornerSparkles(m, t, COLOR.gold);
  };
}

/**
 * Écran de score, avec les chiffres qui "roulent" de `from` vers `value`
 * (effet compteur de flipper). Décorations optionnelles :
 *   - showCoin : pièce qui tourne en haut à droite (défaut: true)
 *   - showBall : bille en bas à gauche (défaut: false)
 */
function score(value: number, popUntil: number, from = value, showCoin = true, showBall = false): Scene {
  let startT: number | null = null;
  const ROLL_MS = 500;
  return (m, t) => {
    if (startT === null) startT = t;
    const p = Math.min((t - startT) / ROLL_MS, 1);
    const eased = 1 - Math.pow(1 - p, 3); // ease-out
    const shown = Math.round(from + (value - from) * eased);

    const rolling = p < 1;
    const popping = t < popUntil;
    const scale = popping && Math.floor(t / 80) % 2 === 0 ? 3 : 2;
    const color = rolling ? COLOR.cyan : popping ? COLOR.yellow : COLOR.gold;

    m.drawText("SCORE", COLOR.blue, 4, 2, 1);
    if (showCoin) m.blit(COIN[Math.floor(t / 110) % COIN.length], m.cols - 11, 1);
    if (showBall) m.blit(BALL, 4, m.rows - 6, 1, COLOR.white);
    m.drawCentered(String(shown), color, scale, Math.round((m.rows - 7 * scale) / 2) + 4);
    edgeDots(m, t, COLOR.gold);
  };
}

function flash(text: string, color: number, scale = 2, blink = false): Scene {
  return (m, t) => {
    cornerSparkles(m, t, color);
    if (blink && Math.floor(t / 150) % 2 === 0) return;
    m.drawCentered(text, color, scale);
  };
}

/** Bille perdue : message + 3 cœurs (pleins = vies restantes, vides = perdues). */
function ballLost(lives: number): Scene {
  const remaining = Math.max(0, Math.min(lives, MAX_LIVES));
  return (m, t) => {
    m.drawCentered("BALL LOST", COLOR.red, 1, 5);
    const heartW = 7;
    const gap = 3;
    const total = MAX_LIVES * heartW + (MAX_LIVES - 1) * gap;
    let x = Math.round((m.cols - total) / 2);
    for (let i = 0; i < MAX_LIVES; i++) {
      m.blit(i < remaining ? HEART : HEART_EMPTY, x, 22);
      x += heartW + gap;
    }
    cornerSparkles(m, t, COLOR.red);
  };
}

/** Game over : "GAME OVER" qui grandit (pop) puis reste affiché. Tout en rouge sauf le score. */
function gameOver(finalScore: number): Scene {
  let startT: number | null = null;
  const GROW_MS = 600;
  const easeBack = (x: number): number => {
    const c1 = 1.70158;
    const c3 = c1 + 1;
    return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2);
  };
  const text = "GAME OVER";

  return (m, t) => {
    if (startT === null) startT = t;
    const p = Math.min((t - startT) / GROW_MS, 1);
    const eased = easeBack(p);

    if (p < 1) {
      const intScale = Math.max(1, Math.round(0.4 + eased * 1.6));
      const w = textWidth(text, intScale);
      const oy = Math.round((m.rows - 7 * intScale) / 2);
      m.drawText(text, COLOR.red, Math.round((m.cols - w) / 2), Math.max(0, oy), intScale);
    } else {
      m.drawText(text, COLOR.red, Math.round((m.cols - textWidth(text, 1)) / 2), 3, 1);
      m.drawCentered(String(finalScore), COLOR.gold, 2, 17);
      cornerSparkles(m, t, COLOR.red);
      edgeDots(m, t, COLOR.red);
    }
  };
}

/**
 * App DMD (Dot Matrix Display) — rendu pixel art sur grille de dots 128×32.
 */
export class DmdApp {
  private readonly root: HTMLElement;
  private readonly matrix: DotMatrix;
  private persistent: Scene = marquee(ATTRACT_TEXT, COLOR.gold);
  private transient: Scene | null = null;
  private transientUntil = 0;
  private rafId: number | null = null;
  private readonly bootTs = performance.now();
  private currentScore = 0;
  private unsubscribe: (() => void) | null = null;

  constructor(host: HTMLElement) {
    this.root = document.createElement("section");
    this.root.className = "dmd-scene";

    const frame = document.createElement("div");
    frame.className = "dmd-frame";
    const canvas = document.createElement("canvas");
    canvas.className = "dmd-canvas";
    frame.appendChild(canvas);
    this.root.appendChild(frame);
    host.appendChild(this.root);

    this.matrix = new DotMatrix(canvas, 128, 32, 7);
    this.loop = this.loop.bind(this);
    this.rafId = requestAnimationFrame(this.loop);
  }


  start(sync: MatchSyncAdapter): void {
    this.unsubscribe = sync.onEvent((event) => this.handleEvent(event));
    this.persistent = marquee(ATTRACT_TEXT, COLOR.gold);
  }

  stop(): void {
    if (this.rafId !== null) cancelAnimationFrame(this.rafId);
    this.rafId = null;
    this.unsubscribe?.();
    this.unsubscribe = null;
  }

  /** DEV-only : injecte un event comme s'il venait du WS. */
  simulate(event: WsServerEvent): void {
    this.handleEvent(event);
  }

  private now(): number {
    return performance.now() - this.bootTs;
  }

  private pushTransient(scene: Scene, durationMs: number): void {
    this.transient = scene;
    this.transientUntil = this.now() + durationMs;
  }

  private handleEvent(event: WsServerEvent): void {
    if (event.type === "nav:state") {
      if (event.nav !== "in_game" && event.nav !== "game_over") {
        this.persistent = marquee(ATTRACT_TEXT, COLOR.gold);
      }
      return;
    }

    switch (event.type) {
      case "match:state":
        if (event.status === "waiting" || event.status === "ready") {
          this.persistent = coinBanner("PRESS START", COLOR.gold);
        } else if (event.status === "playing") {
          this.currentScore = 0;
          this.persistent = score(0, 0);
        } else if (event.status === "paused") {
          this.persistent = flash("PAUSED", COLOR.cyan, 2);
        } else if (event.status === "over") {
          this.persistent = gameOver(this.currentScore);
        }
        return;

      case "countdown:tick":
        this.pushTransient(
          event.value === 0 ? flash("GO!", COLOR.green, 3, true) : flash(String(event.value), COLOR.cyan, 3),
          1100,
        );
        return;

      case "score:update": {
        const previous = this.currentScore;
        this.currentScore = event.score;
        this.persistent = score(event.score, this.now() + 600, previous);
        if (event.combo > 1) this.pushTransient(flash(`COMBO X${event.combo}`, COLOR.pink, 2), 900);
        return;
      }

      case "ball:lost":
        if (event.livesRemaining <= 0) {
          this.pushTransient(ballLost(0), 1200);
          window.setTimeout(() => {
            this.persistent = gameOver(this.currentScore);
          }, 1200);
        } else {
          this.pushTransient(ballLost(event.livesRemaining), 1200);
        }
        return;

      case "game:over":
        this.currentScore = event.finalScore;
        return;
    }
  }

  private loop(): void {
    const t = this.now();
    this.matrix.clear();
    const active = this.transient && t < this.transientUntil ? this.transient : ((this.transient = null), this.persistent);
    active(this.matrix, t);
    this.matrix.present();
    this.rafId = requestAnimationFrame(this.loop);
  }
}