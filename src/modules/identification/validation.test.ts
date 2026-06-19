import { describe, expect, it } from "vitest";
import { validatePseudo } from "./validation";

describe("validatePseudo — format valide", () => {
  it("accepte 3 alphanum et met en majuscules", () => {
    const res = validatePseudo("abc");
    expect(res.ok).toBe(true);
    if (res.ok) expect(res.normalized).toBe("ABC");
  });

  it("accepte lettres + chiffres", () => {
    const res = validatePseudo("A12");
    expect(res.ok).toBe(true);
    if (res.ok) expect(res.normalized).toBe("A12");
  });

  it("trim les espaces autour", () => {
    const res = validatePseudo("  xyz  ");
    expect(res.ok).toBe(true);
    if (res.ok) expect(res.normalized).toBe("XYZ");
  });
});

describe("validatePseudo — format invalide", () => {
  it("rejette une chaîne vide", () => {
    expect(validatePseudo("")).toEqual({ ok: false, error: "Pseudo requis" });
  });

  it("rejette une chaîne d'espaces", () => {
    expect(validatePseudo("   ")).toEqual({ ok: false, error: "Pseudo requis" });
  });

  it("rejette moins de 3 caractères", () => {
    expect(validatePseudo("ab").ok).toBe(false);
  });

  it("rejette plus de 3 caractères", () => {
    expect(validatePseudo("abcd").ok).toBe(false);
  });

  it("rejette le hashtag (plus supporté)", () => {
    expect(validatePseudo("abc#de").ok).toBe(false);
    expect(validatePseudo("ab#").ok).toBe(false);
  });

  it("rejette les caractères non-alphanum", () => {
    expect(validatePseudo("a b").ok).toBe(false);
    expect(validatePseudo("ab-").ok).toBe(false);
    expect(validatePseudo("a@c").ok).toBe(false);
  });
});
