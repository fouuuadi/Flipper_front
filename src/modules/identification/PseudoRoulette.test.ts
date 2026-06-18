import { describe, expect, it } from "vitest";

import { PseudoRouletteModel, ROULETTE_ALPHABET } from "./PseudoRoulette";

describe("PseudoRouletteModel", () => {
  it("démarre sur 'AAA', curseur au 1er slot", () => {
    const m = new PseudoRouletteModel();
    expect(m.pseudo).toBe("AAA");
    expect(m.cursorIndex).toBe(0);
  });

  it("moveChar fait défiler le caractère du slot courant", () => {
    const m = new PseudoRouletteModel();
    m.moveChar(1); // A → B
    expect(m.charAt(0)).toBe("B");
    expect(m.pseudo).toBe("BAA");
  });

  it("moveChar boucle dans les deux sens", () => {
    const m = new PseudoRouletteModel();
    m.moveChar(-1); // A → dernier caractère (9)
    expect(m.charAt(0)).toBe(ROULETTE_ALPHABET[ROULETTE_ALPHABET.length - 1]);
  });

  it("confirm avance le curseur et signale la complétion au dernier slot", () => {
    const m = new PseudoRouletteModel();
    expect(m.confirm()).toBe(false); // slot 0 → 1
    expect(m.cursorIndex).toBe(1);
    expect(m.confirm()).toBe(false); // slot 1 → 2
    expect(m.cursorIndex).toBe(2);
    expect(m.confirm()).toBe(true); // dernier slot → complet
  });

  it("back recule le curseur et signale l'annulation au 1er slot", () => {
    const m = new PseudoRouletteModel();
    m.confirm(); // curseur = 1
    expect(m.back()).toBe(false); // 1 → 0
    expect(m.cursorIndex).toBe(0);
    expect(m.back()).toBe(true); // déjà au 1er → annuler
  });

  it("compose un pseudo de 3 caractères saisis slot par slot", () => {
    const m = new PseudoRouletteModel();
    m.moveChar(1); // B
    m.confirm();
    m.moveChar(2); // C
    m.confirm();
    m.moveChar(3); // D
    expect(m.pseudo).toBe("BCD");
  });
});
