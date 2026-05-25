import { describe, expect, it } from "vitest";
import { validatePseudo } from "./validation";

describe("validatePseudo — format valide", () => {
  it("accepte 3 alphanum sans hashtag et complète avec #HETIC", () => {
    const res = validatePseudo("abc");
    expect(res.ok).toBe(true);
    if (res.ok) expect(res.normalized).toBe("ABC#HETIC");
  });

  it("accepte 3 alphanum + hashtag custom (5 chars)", () => {
    const res = validatePseudo("Foo#bar12");
    expect(res.ok).toBe(true);
    if (res.ok) expect(res.normalized).toBe("FOO#BAR12");
  });

  it("trim les espaces autour", () => {
    const res = validatePseudo("  xyz  ");
    expect(res.ok).toBe(true);
    if (res.ok) expect(res.normalized).toBe("XYZ#HETIC");
  });

  it("uppercase tout (input + hashtag)", () => {
    const res = validatePseudo("AbC#dEf12");
    expect(res.ok).toBe(true);
    if (res.ok) expect(res.normalized).toBe("ABC#DEF12");
  });
});

describe("validatePseudo — format invalide", () => {
  it("rejette une chaîne vide", () => {
    expect(validatePseudo("")).toEqual({ ok: false, error: "Pseudo requis" });
  });

  it("rejette une chaîne d'espaces", () => {
    expect(validatePseudo("   ")).toEqual({ ok: false, error: "Pseudo requis" });
  });

  it("rejette moins de 3 caractères avant le #", () => {
    const res = validatePseudo("ab");
    expect(res.ok).toBe(false);
  });

  it("rejette plus de 3 caractères avant le #", () => {
    const res = validatePseudo("abcd");
    expect(res.ok).toBe(false);
  });

  it("rejette un hashtag de mauvaise longueur", () => {
    expect(validatePseudo("abc#1234").ok).toBe(false);
    expect(validatePseudo("abc#123456").ok).toBe(false);
  });

  it("rejette les caractères non-alphanum", () => {
    expect(validatePseudo("a b").ok).toBe(false);
    expect(validatePseudo("abc-").ok).toBe(false);
    expect(validatePseudo("abc#bar-1").ok).toBe(false);
  });
});
