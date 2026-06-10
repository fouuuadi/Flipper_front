import type { Player } from "@core/gameMachine.types";

export type WinnerResult =
  | { readonly kind: "solo" }
  | { readonly kind: "winner"; readonly player: Player }
  | { readonly kind: "draw" };

/**
 * Détermine le vainqueur d'une partie 1v1 à partir des scores du contexte SM.
 * En solo, renvoie `{ kind: "solo" }` (pas de notion de vainqueur).
 * Fonction pure, testable indépendamment du DOM.
 */
export function pickWinner(players: ReadonlyArray<Player>): WinnerResult {
  if (players.length < 2) return { kind: "solo" };
  const [a, b] = players;
  if (a.score === b.score) return { kind: "draw" };
  return { kind: "winner", player: a.score > b.score ? a : b };
}
