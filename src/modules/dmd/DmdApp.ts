import type { MatchSyncAdapter, WsServerEvent } from "@services/matchSync";
import { DotMatrix } from "./dotMatrix";
import { textWidth } from "./font5x7";
import { BALL, COIN, COLOR, HEART, HEART_EMPTY, SPARKLE } from "./sprites";
import "./dmd.css";

/** Une scène dessine une frame du DMD à l'instant `t` */
type Scene = (m: DotMatrix, t: number) => void;

const ATTRACT_TEXT = "* MARIO DELUXE PINBALL *  INSERT COIN  ";
const MAX_LIVES = 3;

/** Calcule une grille de dots qui conserve des pixels carrés, quel que soit l'écran. */
export function getDmdGridDimensions(
  width: number,
  height: number,
): { cols: number; rows: number } {
  const safeWidth = Number.isFinite(width) && width > 0 ? width : 128;
  const safeHeight = Number.isFinite(height) && height > 0 ? height : 32;
  const aspect = Math.max(0.25, Math.min(safeWidth / safeHeight, 8));

  if (aspect >= 2) {
    const rows = 32;
    return { cols: Math.min(256, Math.max(80, Math.round(rows * aspect))), rows };
  }

  const cols = 80;
  return { cols, rows: Math.min(256, Math.max(40, Math.round(cols / aspect))) };
}

function fitScale(m: DotMatrix, text: string, preferred: number, padding = 4): number {
  const horizontal = Math.floor((m.cols - padding * 2) / textWidth(text));
  const vertical = Math.floor((m.rows - padding * 2) / 7);
  return Math.max(1, Math.min(preferred, horizontal, vertical));
}

function centeredY(m: DotMatrix, height: number): number {
  return Math.round((m.rows - height) / 2);
}

// ── Décorations réutilisables (toujours dans les marges) ─────────────

/** Étincelle qui clignote en 3 états (éteinte → point → étoile). */
function twinkle(
  m: DotMatrix,
  t: number,
  x: number,
  y: number,
  phase: number,
  color: number,
): void {
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
    m.drawText(text, color, Math.round(x), centeredY(m, 7));
    cornerSparkles(m, t);
    edgeDots(m, t, COLOR.red);
  };
}

function coinBanner(text: string, color: number): Scene {
  return (m, t) => {
    const frame = COIN[Math.floor(t / 110) % COIN.length];
    const y = centeredY(m, 8);
    m.blit(frame, 6, y);
    m.blit(frame, m.cols - 14, y);
    m.drawCentered(text, color, fitScale(m, text, 1));
    cornerSparkles(m, t, COLOR.gold);
  };
}

/**
 * Écran de score, avec les chiffres qui "roulent" de `from` vers `value`
 * (effet compteur de flipper). Décorations optionnelles :
 *   - showCoin : pièce qui tourne en haut à droite (défaut: true)
 *   - showBall : bille en bas à gauche (défaut: false)
 */
function score(
  value: number,
  popUntil: number,
  from = value,
  showCoin = true,
  showBall = false,
): Scene {
  let startT: number | null = null;
  const ROLL_MS = 500;
  return (m, t) => {
    if (startT === null) startT = t;
    const p = Math.min((t - startT) / ROLL_MS, 1);
    const eased = 1 - Math.pow(1 - p, 3); // ease-out
    const shown = Math.round(from + (value - from) * eased);

    const rolling = p < 1;
    const popping = t < popUntil;
    const preferredScale = popping && Math.floor(t / 80) % 2 === 0 ? 3 : 2;
    const scale = fitScale(m, String(shown), preferredScale, 6);
    const color = rolling ? COLOR.cyan : popping ? COLOR.yellow : COLOR.gold;

    const center = Math.round(m.rows / 2);
    m.drawText("SCORE", COLOR.blue, 4, Math.max(2, center - 15), 1);
    if (showCoin)
      m.blit(COIN[Math.floor(t / 110) % COIN.length], m.cols - 11, Math.max(1, center - 16));
    if (showBall) m.blit(BALL, 4, Math.min(m.rows - 6, center + 10), 1, COLOR.white);
    m.drawCentered(String(shown), color, scale, centeredY(m, 7 * scale) + 4);
    edgeDots(m, t, COLOR.gold);
  };
}

function flash(text: string, color: number, scale = 2, blink = false): Scene {
  return (m, t) => {
    cornerSparkles(m, t, color);
    if (blink && Math.floor(t / 150) % 2 === 0) return;
    m.drawCentered(text, color, fitScale(m, text, scale));
  };
}

/** Bille perdue : message + 3 cœurs (pleins = vies restantes, vides = perdues). */
function ballLost(lives: number): Scene {
  const remaining = Math.max(0, Math.min(lives, MAX_LIVES));
  return (m, t) => {
    const center = Math.round(m.rows / 2);
    m.drawCentered("BALL LOST", COLOR.red, fitScale(m, "BALL LOST", 1), center - 11);
    const heartW = 7;
    const gap = 3;
    const total = MAX_LIVES * heartW + (MAX_LIVES - 1) * gap;
    let x = Math.round((m.cols - total) / 2);
    for (let i = 0; i < MAX_LIVES; i++) {
      m.blit(i < remaining ? HEART : HEART_EMPTY, x, center + 5);
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
      const intScale = fitScale(m, text, Math.max(1, Math.round(0.4 + eased * 1.6)));
      const w = textWidth(text, intScale);
      const oy = Math.round((m.rows - 7 * intScale) / 2);
      m.drawText(text, COLOR.red, Math.round((m.cols - w) / 2), Math.max(0, oy), intScale);
    } else {
      const center = Math.round(m.rows / 2);
      m.drawText(text, COLOR.red, Math.round((m.cols - textWidth(text, 1)) / 2), center - 12, 1);
      const scoreScale = fitScale(m, String(finalScore), 2, 6);
      m.drawCentered(String(finalScore), COLOR.gold, scoreScale, center + 2);
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
  private readonly canvas: HTMLCanvasElement;
  private matrix: DotMatrix;
  private resizeObserver: ResizeObserver | null = null;
  private persistent: Scene = marquee(ATTRACT_TEXT, COLOR.gold);
  private transient: Scene | null = null;
  private transientUntil = 0;
  private rafId: number | null = null;
  private readonly bootTs = performance.now();
  private currentScore = 0;
  private currentPlayer = "";
  private matchIsOver = false;
  private unsubscribe: (() => void) | null = null;

  constructor(host: HTMLElement) {
    this.root = document.createElement("section");
    this.root.className = "dmd-scene";

    const frame = document.createElement("div");
    frame.className = "dmd-frame";
    const canvas = document.createElement("canvas");
    canvas.className = "dmd-canvas";
    this.canvas = canvas;
    frame.appendChild(canvas);
    this.root.appendChild(frame);
    host.appendChild(this.root);

    this.matrix = this.createResponsiveMatrix();
    if (typeof ResizeObserver !== "undefined") {
      this.resizeObserver = new ResizeObserver(() => this.resizeMatrix());
      this.resizeObserver.observe(frame);
    } else {
      window.addEventListener("resize", this.resizeMatrix);
    }
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
    this.resizeObserver?.disconnect();
    this.resizeObserver = null;
    window.removeEventListener("resize", this.resizeMatrix);
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

  private readonly resizeMatrix = (): void => {
    const { cols, rows } = this.getResponsiveGrid();
    if (cols === this.matrix.cols && rows === this.matrix.rows) return;
    this.matrix = new DotMatrix(this.canvas, cols, rows, 7);
  };

  private createResponsiveMatrix(): DotMatrix {
    const { cols, rows } = this.getResponsiveGrid();
    return new DotMatrix(this.canvas, cols, rows, 7);
  }

  private getResponsiveGrid(): { cols: number; rows: number } {
    const width = this.canvas.clientWidth || window.innerWidth || 128;
    const height = this.canvas.clientHeight || window.innerHeight || 32;
    return getDmdGridDimensions(width, height);
  }

  private pushTransient(scene: Scene, durationMs: number): void {
    this.transient = scene;
    this.transientUntil = this.now() + durationMs;
  }

  private handleEvent(event: WsServerEvent): void {
    if (event.type === "nav:state") {
      if (event.nav !== "in_game" && event.nav !== "game_over") {
        this.currentScore = 0;
        this.currentPlayer = "";
        this.matchIsOver = false;
        this.persistent = marquee(ATTRACT_TEXT, COLOR.gold);
      }
      return;
    }

    switch (event.type) {
      case "session:snapshot":
        this.currentScore = event.score;
        this.currentPlayer = event.players[0] ?? "";
        this.matchIsOver = event.status === "over";
        if (event.status === "waiting" || event.status === "ready") {
          this.persistent = coinBanner(this.currentPlayer || "PRESS START", COLOR.gold);
        } else if (event.status === "paused") {
          this.persistent = flash("PAUSED", COLOR.cyan, 2);
        } else if (event.status === "over") {
          this.persistent = gameOver(event.score);
        } else {
          this.persistent = score(event.score, 0);
        }
        return;

      case "match:state":
        if (event.status === "waiting" || event.status === "ready") {
          this.currentScore = 0;
          this.matchIsOver = false;
          this.persistent = coinBanner(this.currentPlayer || "PRESS START", COLOR.gold);
        } else if (event.status === "playing") {
          // `playing` est aussi émis à la reprise après une pause : le score
          // courant doit donc être conservé ici.
          this.matchIsOver = false;
          this.persistent = score(this.currentScore, 0);
        } else if (event.status === "paused") {
          this.matchIsOver = false;
          this.persistent = flash("PAUSED", COLOR.cyan, 2);
        } else if (event.status === "over") {
          this.matchIsOver = true;
          this.persistent = gameOver(this.currentScore);
        }
        return;

      case "countdown:tick":
        this.pushTransient(
          event.value === 0
            ? flash("GO!", COLOR.green, 3, true)
            : flash(String(event.value), COLOR.cyan, 3),
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
        // Robuste quel que soit l'ordre d'arrivée de `game:over` et
        // `match:state: over` sur le WebSocket.
        if (this.matchIsOver) this.persistent = gameOver(this.currentScore);
        return;
    }
  }

  private loop(): void {
    const t = this.now();
    this.matrix.clear();
    const active =
      this.transient && t < this.transientUntil
        ? this.transient
        : ((this.transient = null), this.persistent);
    active(this.matrix, t);
    this.matrix.present();
    this.rafId = requestAnimationFrame(this.loop);
  }
}
