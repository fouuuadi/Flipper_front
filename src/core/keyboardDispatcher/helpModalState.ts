/**
 * Mini-singleton qui expose l'état d'ouverture de la modal d'aide clavier.
 *
 * Le `KeyboardDispatcher` consulte `isOpen()` pour court-circuiter le routage
 * des touches quand la modal a le focus — sinon `?` ouvrirait la modal puis
 * la touche suivante (genre `A` en pause) déclencherait l'event SM par
 * dessous, ce qui est incorrect UX.
 *
 * La modal `KeybindingsHelp` est seule responsable d'appeler `open()` /
 * `close()`. Pas un store réactif — un simple flag mutable suffit pour ce
 * cas et garde le couplage minimal entre dispatcher et modal.
 */

let _isOpen = false;

export const helpModalState = {
  isOpen(): boolean {
    return _isOpen;
  },
  open(): void {
    _isOpen = true;
  },
  close(): void {
    _isOpen = false;
  },
  /** Reset utile pour les tests unitaires (réinitialise entre 2 tests). */
  __reset(): void {
    _isOpen = false;
  },
};
