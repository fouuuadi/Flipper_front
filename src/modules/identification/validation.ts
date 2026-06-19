import type { PlayerTag } from "@core/gameMachine.types";

/**
 * Pseudo accepté par le serveur : exactement 3 caractères alphanumériques
 * (style initiales de borne d'arcade). Plus de hashtag.
 */
export const PSEUDO_INPUT_PATTERN = /^[A-Za-z0-9]{3}$/;

export type ValidationResult =
  | { readonly ok: true; readonly normalized: PlayerTag }
  | { readonly ok: false; readonly error: string };

/**
 * Validation pure du format. Utilisée pour gate le bouton "lancer la partie"
 * et pour générer un PlayerTag de fallback côté front (1v1 mock, en attendant
 * le matchmaking back — cf. issue #59 du back).
 *
 * La normalisation finale fait foi côté serveur : sur succès de POST /sessions,
 * remplacer le tag local par la valeur renvoyée dans la response.
 */
export function validatePseudo(input: string): ValidationResult {
  const trimmed = input.trim();
  if (trimmed.length === 0) {
    return { ok: false, error: "Pseudo requis" };
  }
  if (!PSEUDO_INPUT_PATTERN.test(trimmed)) {
    return {
      ok: false,
      error: "Format : 3 caractères (lettres/chiffres)",
    };
  }
  return { ok: true, normalized: trimmed.toUpperCase() as PlayerTag };
}
