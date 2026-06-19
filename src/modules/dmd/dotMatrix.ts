import { FONT, GLYPH_ADVANCE, GLYPH_H, textWidth } from "./font5x7";
import { PALETTE, type Sprite } from "./sprites";

/**
 * Moteur de rendu DMD : une grille de dots (par défaut 128×32
 */
export class DotMatrix {
  readonly cols: number;
  readonly rows: number;
  private readonly dot: number;
  private readonly ctx: CanvasRenderingContext2D;
  private readonly buffer: Uint8Array;

  constructor(canvas: HTMLCanvasElement, cols = 128, rows = 32, dot = 7) {
    this.cols = cols;
    this.rows = rows;
    this.dot = dot;

    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("DotMatrix: contexte 2D indisponible");
    this.ctx = ctx;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = cols * dot * dpr;
    canvas.height = rows * dot * dpr;
    ctx.scale(dpr, dpr);

    this.buffer = new Uint8Array(cols * rows);
  }

  clear(): void {
    this.buffer.fill(0);
  }

  setPixel(x: number, y: number, color: number): void {
    x = Math.round(x);
    y = Math.round(y);
    if (x < 0 || y < 0 || x >= this.cols || y >= this.rows) return;
    this.buffer[y * this.cols + x] = color;
  }

  /** Dessine une glyphe ou un sprite */
  blit(grid: Sprite, ox: number, oy: number, scale = 1, colorOverride: number | null = null): void {
    for (let r = 0; r < grid.length; r++) {
      const row = grid[r];
      for (let c = 0; c < row.length; c++) {
        const ch = row[c];
        if (ch === "." || ch === " ") continue;
        const color = colorOverride !== null ? colorOverride : Number(ch);
        if (scale === 1) {
          this.setPixel(ox + c, oy + r, color);
          continue;
        }
        for (let sy = 0; sy < scale; sy++) {
          for (let sx = 0; sx < scale; sx++) {
            this.setPixel(ox + c * scale + sx, oy + r * scale + sy, color);
          }
        }
      }
    }
  }

  drawText(text: string, color: number, ox: number, oy: number, scale = 1): void {
    const upper = text.toUpperCase();
    let x = ox;
    for (const ch of upper) {
      this.blit(FONT[ch] ?? FONT[" "], x, oy, scale, color);
      x += GLYPH_ADVANCE * scale;
    }
  }

  /** Texte centré horizontalement, à l'ordonnée verticale centrée par défaut. */
  drawCentered(text: string, color: number, scale = 1, oy?: number): void {
    const ox = Math.round((this.cols - textWidth(text.toUpperCase(), scale)) / 2);
    const top = oy ?? Math.round((this.rows - GLYPH_H * scale) / 2);
    this.drawText(text, color, ox, top, scale);
  }

  /** Matérialise le buffer dans le canvas. */
  present(): void {
    const { ctx, cols, rows, dot } = this;
    ctx.clearRect(0, 0, cols * dot, rows * dot);
    const c = dot / 2;
    const rCore = dot * 0.42;
    const rHalo = dot * 0.95;

    // pass 0 — dots éteints
    ctx.fillStyle = "rgba(60,40,90,0.16)";
    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < cols; x++) {
        if (this.buffer[y * cols + x]) continue;
        ctx.beginPath();
        ctx.arc(x * dot + c, y * dot + c, dot * 0.3, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    // pass 1 — halo
    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < cols; x++) {
        const v = this.buffer[y * cols + x];
        if (!v) continue;
        ctx.fillStyle = `rgba(${PALETTE[v]},0.22)`;
        ctx.beginPath();
        ctx.arc(x * dot + c, y * dot + c, rHalo, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    // pass 2 — cœur
    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < cols; x++) {
        const v = this.buffer[y * cols + x];
        if (!v) continue;
        ctx.fillStyle = `rgb(${PALETTE[v]})`;
        ctx.beginPath();
        ctx.arc(x * dot + c, y * dot + c, rCore, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }
}