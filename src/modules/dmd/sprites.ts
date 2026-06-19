/**
 * Palette indexée + sprites pixel art du DMD.
 *
 * Format d'un sprite : tableau de lignes. Chaque caractère est :
 *   - un chiffre 1-8  → index palette (dot allumé de cette couleur)
 *   - '.' ou ' '      → transparent
 *
 * Les sprites fournis sont des assets retro génériques (pas les sprites
 * Nintendo) ; pour un rendu noté, garde des assets originaux côté droits.
 */

/** index → composantes "r,g,b" (alignées sur tes tokens néon). */
export const PALETTE: Readonly<Record<number, string>> = {
  1: "255,255,255", // white
  2: "255,71,87", // neon-red
  3: "255,165,2", // neon-orange (gold)
  4: "255,217,61", // neon-yellow
  5: "107,207,127", // neon-green
  6: "77,159,255", // neon-blue
  7: "0,212,255", // neon-cyan
  8: "255,51,102", // neon-pink
};

/** Alias lisibles pour le code applicatif. */
export const COLOR = {
  white: 1,
  red: 2,
  gold: 3,
  yellow: 4,
  green: 5,
  blue: 6,
  cyan: 7,
  pink: 8,
} as const;

export type Sprite = readonly string[];

/** Pièce dorée — 4 frames de rotation (cycle conseillé : 0,1,2,1). */
export const COIN: readonly Sprite[] = [
  ["..3333..", ".333333.", ".344443.", ".344443.", ".344443.", ".344443.", ".333333.", "..3333.."],
  ["...33...", "..3333..", "..3443..", "..3443..", "..3443..", "..3443..", "..3333..", "...33..."],
  ["...33...", "...43...", "...43...", "...43...", "...43...", "...43...", "...43...", "...33..."],
  ["...33...", "..3333..", "..3443..", "..3443..", "..3443..", "..3443..", "..3333..", "...33..."],
];

export const STAR: Sprite = ["...4...", "...4...", "4444444", ".44444.", "..444..", ".44.44.", "4.....4"];

/** Cœur plein (vie restante). */
export const HEART: Sprite = [".22.22.", "2222222", "2222222", ".22222.", "..222..", "...2..."];

/** Cœur vide (vie perdue) — contour seul. */
export const HEART_EMPTY: Sprite = [".22.22.", "2....2.", "2....2.", ".2..2..", "..22...", "...2..."];

/** Étincelle 4 branches (décoration scintillante). */
export const SPARKLE: Sprite = ["..4..", "..4..", "44444", "..4..", "..4.."];

/** Bille (acier) — décoration optionnelle des écrans de jeu. */
export const BALL: Sprite = [".111.", "11111", "11111", "11111", ".111."];

