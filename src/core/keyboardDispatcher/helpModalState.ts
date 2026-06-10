/**
 * Mini-singleton qui expose l'état d'ouverture de la modal d'aide clavier.
 *
 * Le `KeyboardDispatcher` consulte `isOpen()` pour court-circuiter le routage
 * des touches quand la modal a le focus — sinon `?` ouvrirait la modal puis
 * la touche suivante (genre `A` en pause) déclencherait l'event SM par
 * dessous, ce qui est incorrect UX.
 *
 * Expose aussi `subscribe(listener)` pour les consommateurs qui doivent
 * réagir à l'ouverture/fermeture (ex: `KeybindingsHelpHint` qui se cache
 * pendant que la modal est visible). Pas d'event-bus complet — un set de
 * listeners suffit, le scope est limité à 2-3 consommateurs.
 *
 * La modal `KeybindingsHelp` est seule responsable d'appeler `open()` /
 * `close()`.
 */

let _isOpen = false;
const listeners = new Set<() => void>();

function notify(): void {
  for (const listener of listeners) {
    listener();
  }
}

export const helpModalState = {
  isOpen(): boolean {
    return _isOpen;
  },
  open(): void {
    if (_isOpen) return;
    _isOpen = true;
    notify();
  },
  close(): void {
    if (!_isOpen) return;
    _isOpen = false;
    notify();
  },
  /**
   * S'abonne aux changements d'état (open ↔ close). Retourne un disposer.
   * Le listener n'est PAS invoqué immédiatement — il l'est uniquement sur
   * transition réelle.
   */
  subscribe(listener: () => void): () => void {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  },
  /** Reset utile pour les tests unitaires (réinitialise état + listeners). */
  __reset(): void {
    _isOpen = false;
    listeners.clear();
  },
};
