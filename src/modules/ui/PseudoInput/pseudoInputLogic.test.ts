import { describe, expect, it } from "vitest";

import {
  assemblePseudo,
  decomposePseudo,
  isValidChar,
  normalizeChar,
  shouldAdvanceAfterInput,
  shouldRetreatOnBackspace,
  TOTAL_BOXES,
} from "./pseudoInputLogic";

describe("pseudoInputLogic", () => {
  describe("isValidChar / normalizeChar", () => {
    it("accepte les lettres et chiffres ASCII", () => {
      expect(isValidChar("A")).toBe(true);
      expect(isValidChar("z")).toBe(true);
      expect(isValidChar("0")).toBe(true);
      expect(isValidChar("9")).toBe(true);
    });

    it("rejette les caractères spéciaux et accents", () => {
      expect(isValidChar("#")).toBe(false);
      expect(isValidChar("é")).toBe(false);
      expect(isValidChar(" ")).toBe(false);
      expect(isValidChar("")).toBe(false);
      expect(isValidChar("AB")).toBe(false); // un seul char à la fois
    });

    it("normalizeChar uppercase les lettres", () => {
      expect(normalizeChar("a")).toBe("A");
      expect(normalizeChar("Z")).toBe("Z");
      expect(normalizeChar("7")).toBe("7");
    });

    it("normalizeChar retourne null pour caractère invalide", () => {
      expect(normalizeChar("#")).toBeNull();
      expect(normalizeChar(" ")).toBeNull();
    });
  });

  describe("assemblePseudo", () => {
    it("retourne chaîne vide si toutes les cases sont vides", () => {
      expect(assemblePseudo(["", "", "", "", "", "", "", ""])).toBe("");
    });

    it("retourne seulement le pseudo si hashtag vide (back applique #HETIC)", () => {
      expect(assemblePseudo(["A", "B", "C", "", "", "", "", ""])).toBe("ABC");
    });

    it("assemble pseudo + # + hashtag complet", () => {
      expect(assemblePseudo(["A", "B", "C", "X", "Y", "Z", "1", "2"])).toBe("ABC#XYZ12");
    });

    it("inclut le # même si hashtag partiel (validation rejettera ensuite)", () => {
      expect(assemblePseudo(["A", "B", "C", "X", "Y", "", "", ""])).toBe("ABC#XY");
    });

    it("throw si nombre de cases incorrect", () => {
      expect(() => assemblePseudo(["A", "B"])).toThrow();
      expect(() => assemblePseudo(new Array(9).fill("X"))).toThrow();
    });
  });

  describe("decomposePseudo", () => {
    it("découpe ABC#XYZ12 en 8 cases", () => {
      expect(decomposePseudo("ABC#XYZ12")).toEqual(["A", "B", "C", "X", "Y", "Z", "1", "2"]);
    });

    it("découpe ABC sans hashtag (cases 4-8 vides)", () => {
      expect(decomposePseudo("ABC")).toEqual(["A", "B", "C", "", "", "", "", ""]);
    });

    it("découpe ABC#XY (hashtag partiel) sans crasher", () => {
      expect(decomposePseudo("ABC#XY")).toEqual(["A", "B", "C", "X", "Y", "", "", ""]);
    });

    it("normalise en uppercase et ignore les caractères invalides", () => {
      expect(decomposePseudo("ab1#x_z@9")).toEqual(["A", "B", "1", "X", "Z", "9", "", ""]);
    });

    it("tronque silencieusement les chaînes trop longues", () => {
      // 5 chars avant #, 7 après → on garde 3 et 5
      expect(decomposePseudo("ABCDE#XYZ1234567")).toEqual(["A", "B", "C", "X", "Y", "Z", "1", "2"]);
    });

    it("retourne 8 cases vides pour chaîne vide", () => {
      expect(decomposePseudo("")).toEqual(["", "", "", "", "", "", "", ""]);
    });

    it("résultat de decomposePseudo a toujours TOTAL_BOXES éléments", () => {
      expect(decomposePseudo("").length).toBe(TOTAL_BOXES);
      expect(decomposePseudo("AB").length).toBe(TOTAL_BOXES);
      expect(decomposePseudo("AB#X").length).toBe(TOTAL_BOXES);
    });

    it("est inverse de assemblePseudo (round-trip)", () => {
      const samples = ["", "ABC", "ABC#XYZAB", "FOU#12345", "XY", "ABC#X"];
      for (const s of samples) {
        const boxes = decomposePseudo(s);
        expect(assemblePseudo(boxes), `round-trip ${s}`).toBe(s);
      }
    });
  });

  describe("shouldAdvanceAfterInput", () => {
    it("avance quand on remplit une case vide", () => {
      expect(shouldAdvanceAfterInput(true, true)).toBe(true);
    });

    it("n'avance pas quand on retape sur une case déjà remplie (remplacement)", () => {
      // wasEmpty=false : la case avait déjà un contenu, on l'a remplacé sur place
      expect(shouldAdvanceAfterInput(false, true)).toBe(false);
    });

    it("n'avance pas quand la case finit vide (cas marginal)", () => {
      expect(shouldAdvanceAfterInput(true, false)).toBe(false);
      expect(shouldAdvanceAfterInput(false, false)).toBe(false);
    });
  });

  describe("shouldRetreatOnBackspace", () => {
    it("recule quand la case est déjà vide (2e backspace)", () => {
      expect(shouldRetreatOnBackspace("")).toBe(true);
    });

    it("ne recule pas tant que la case a du contenu (1er backspace efface)", () => {
      expect(shouldRetreatOnBackspace("A")).toBe(false);
    });
  });
});
