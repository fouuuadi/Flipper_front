/**
 * Logique pure du `PseudoInput` (8 cases avec `#` figé au milieu).
 *
 * Extrait pour pouvoir tester sans dépendre du DOM (vitest tourne en `node`,
 * pas de jsdom dans le projet).
 */

/** Index des cases : 0-2 = pseudo (avant `#`), 3-7 = hashtag (après `#`). */
export const PSEUDO_LENGTH = 3;
export const HASHTAG_LENGTH = 5;
export const TOTAL_BOXES = PSEUDO_LENGTH + HASHTAG_LENGTH; // 8

/**
 * Caractères acceptés dans une case : alphanumériques uniquement, alignés
 * sur le pattern back `[A-Za-z0-9]`.
 */
const VALID_CHAR = /^[A-Za-z0-9]$/;

export function isValidChar(char: string): boolean {
  return VALID_CHAR.test(char);
}

/**
 * Normalise un caractère pour affichage : uppercase et filtré aux
 * alphanumériques. Retourne `null` si le caractère est invalide.
 */
export function normalizeChar(char: string): string | null {
  if (!isValidChar(char)) return null;
  return char.toUpperCase();
}

/**
 * Assemble la valeur finale à partir des 8 cases :
 *   - "" si toutes les cases sont vides
 *   - "ABC" si seules les 3 premières sont remplies (hashtag vide → le back
 *     appliquera #HETIC par défaut)
 *   - "ABC#XYZAB" si pseudo + hashtag complets
 *   - "ABC#XY" (intermédiaire) si le hashtag est partiellement rempli — la
 *     validation `validatePseudo` rejettera ce cas (format non conforme)
 */
export function assemblePseudo(boxes: readonly string[]): string {
  if (boxes.length !== TOTAL_BOXES) {
    throw new Error(`Expected ${TOTAL_BOXES} boxes, got ${boxes.length}`);
  }
  const left = boxes.slice(0, PSEUDO_LENGTH).join("");
  const right = boxes.slice(PSEUDO_LENGTH).join("");
  if (right.length === 0) return left;
  return `${left}#${right}`;
}

/**
 * Décompose une valeur (ex: "ABC#XY") en 8 cases. Utile pour pré-remplir
 * l'input depuis un pseudo existant (replay, restauration de session…).
 *
 * Les caractères non-alphanumériques sont ignorés, les majuscules forcées.
 * Tronque silencieusement si plus de 3+5 chars sont passés.
 */
export function decomposePseudo(value: string): string[] {
  const boxes = new Array<string>(TOTAL_BOXES).fill("");
  const hashIdx = value.indexOf("#");
  const rawLeft = hashIdx >= 0 ? value.slice(0, hashIdx) : value;
  const rawRight = hashIdx >= 0 ? value.slice(hashIdx + 1) : "";

  let pos = 0;
  for (const ch of rawLeft) {
    if (pos >= PSEUDO_LENGTH) break;
    const norm = normalizeChar(ch);
    if (norm !== null) {
      boxes[pos] = norm;
      pos += 1;
    }
  }

  pos = PSEUDO_LENGTH;
  for (const ch of rawRight) {
    if (pos >= TOTAL_BOXES) break;
    const norm = normalizeChar(ch);
    if (norm !== null) {
      boxes[pos] = norm;
      pos += 1;
    }
  }

  return boxes;
}

/**
 * Indique si une transition de focus est attendue après une saisie.
 *
 * @param wasEmpty  true si la case était vide avant la saisie
 * @param hasContent true si la case contient désormais un caractère
 * @returns true s'il faut focus la case suivante (auto-advance)
 */
export function shouldAdvanceAfterInput(wasEmpty: boolean, hasContent: boolean): boolean {
  return wasEmpty && hasContent;
}

/**
 * Indique si Backspace sur une case doit faire reculer le focus.
 * Vrai uniquement si la case est déjà vide (la première backspace efface,
 * la seconde recule).
 */
export function shouldRetreatOnBackspace(currentValue: string): boolean {
  return currentValue.length === 0;
}
