import { describe, expect, it } from "vitest";
import { getDmdGridDimensions } from "./DmdApp";

describe("getDmdGridDimensions", () => {
  it("conserve la grille DMD 128x32 sur un écran 4:1", () => {
    expect(getDmdGridDimensions(1280, 320)).toEqual({ cols: 128, rows: 32 });
  });

  it("adapte la grille à un écran carré", () => {
    expect(getDmdGridDimensions(800, 800)).toEqual({ cols: 80, rows: 80 });
  });

  it("adapte la grille à un écran portrait", () => {
    expect(getDmdGridDimensions(540, 960)).toEqual({ cols: 80, rows: 142 });
  });

  it("utilise un format sûr lorsque la taille est invalide", () => {
    expect(getDmdGridDimensions(0, 0)).toEqual({ cols: 128, rows: 32 });
  });
});
