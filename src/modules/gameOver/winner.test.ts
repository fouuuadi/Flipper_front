import { describe, expect, it } from "vitest";
import type { Player, PlayerTag } from "@core/gameMachine.types";
import { pickWinner } from "./winner";

const player = (tag: string, score: number): Player => ({
  tag: tag as PlayerTag,
  score,
  ballsRemaining: 0,
});

describe("pickWinner", () => {
  it("retourne 'solo' quand il n'y a qu'un joueur", () => {
    expect(pickWinner([player("A#1", 100)])).toEqual({ kind: "solo" });
  });

  it("retourne 'solo' quand la liste est vide", () => {
    expect(pickWinner([])).toEqual({ kind: "solo" });
  });

  it("retourne le joueur 1 si son score est plus haut", () => {
    const players = [player("A#1", 200), player("B#2", 100)];
    const res = pickWinner(players);
    expect(res).toEqual({ kind: "winner", player: players[0] });
  });

  it("retourne le joueur 2 si son score est plus haut", () => {
    const players = [player("A#1", 50), player("B#2", 300)];
    const res = pickWinner(players);
    expect(res).toEqual({ kind: "winner", player: players[1] });
  });

  it("retourne 'draw' en cas d'égalité", () => {
    expect(pickWinner([player("A#1", 100), player("B#2", 100)])).toEqual({
      kind: "draw",
    });
  });
});
