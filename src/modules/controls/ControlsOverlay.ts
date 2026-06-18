import "./controlsOverlay.css";

interface ControlRow {
  /** Bouton physique de la borne. */
  readonly button: string;
  /** Équivalent clavier en dev. */
  readonly key: string;
  /** Ce que ça fait dans l'application. */
  readonly action: string;
}

// Référence des contrôles de toute l'application : en prod ce sont les boutons
// de la borne, en dev les touches clavier équivalentes.
const CONTROLS: readonly ControlRow[] = [
  { button: "Vert", key: "Entrée", action: "Valider / Démarrer" },
  { button: "Rouge", key: "Échap", action: "Retour / Annuler" },
  { button: "Gauche / Droite", key: "← →", action: "Naviguer (menu, roulette)" },
  { button: "Noir gauche / droit", key: "Shift G / D", action: "Flippers gauche / droit" },
  { button: "Plunger", key: "Espace", action: "Lancer la bille" },
  { button: "Orange", key: "H", action: "Afficher / masquer cet écran" },
];

/**
 * Overlay « Contrôles » : rappelle quel bouton fait quoi sur toute l'app.
 * Togglé par le bouton orange de la borne (`control:nav: help`) ou la touche `H`
 * en dev. Global (au-dessus de l'écran courant), masqué par défaut.
 */
export class ControlsOverlay {
  private readonly root: HTMLElement;
  private visible = false;

  constructor() {
    this.root = document.createElement("div");
    this.root.className = "controls-overlay";
    this.root.hidden = true;

    const card = document.createElement("div");
    card.className = "controls-overlay-card";
    this.root.appendChild(card);

    const title = document.createElement("h2");
    title.className = "controls-overlay-title";
    title.textContent = "Contrôles";
    card.appendChild(title);

    const table = document.createElement("table");
    table.className = "controls-overlay-table";
    for (const row of CONTROLS) {
      const tr = document.createElement("tr");
      for (const text of [row.button, row.key, row.action]) {
        const td = document.createElement("td");
        td.textContent = text;
        tr.appendChild(td);
      }
      table.appendChild(tr);
    }
    card.appendChild(table);

    const hint = document.createElement("p");
    hint.className = "controls-overlay-hint";
    hint.textContent = "Bouton orange (ou H) pour fermer";
    card.appendChild(hint);
  }

  mount(host: HTMLElement): void {
    host.appendChild(this.root);
  }

  unmount(): void {
    this.root.remove();
  }

  toggle(): void {
    this.visible = !this.visible;
    this.root.hidden = !this.visible;
  }
}
