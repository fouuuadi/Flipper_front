import { Button, PseudoInput } from "@modules/ui";
import { dispatchIntent } from "@core/keyboardDispatcher";
import { gameStore } from "@core/gameStore";
import { dispatchDevLocalCommand } from "@core/devLocalSync";
import type { GameMode, PlayerTag } from "@core/gameMachine.types";
import { matchSync } from "@services/matchSync";
import { menuAudio } from "@services/menuAudio";
import { savePlayerSession } from "@services/playerSession";
import { validatePseudo } from "./validation";
import "./identification.css";

interface PlayerSlot {
  readonly input: PseudoInput;
  validated: PlayerTag | null;
}

/**
 * Ecran d'identification des joueurs (solo / 1v1).
 *
 * L'ecran collecte le(s) pseudo(s) puis dispatch l'intent PLAYERS_VALIDATED
 * sur le bus borne. Le backend cree la session et pilote la suite.
 */
export class Identification {
  private readonly root: HTMLElement;
  private readonly globalError: HTMLElement;
  private readonly playersContainer: HTMLElement;
  private readonly submitButton: Button;
  private readonly modeButtons: { solo: Button; "1v1": Button };
  private slots: PlayerSlot[] = [];
  private mode: GameMode = "solo";
  private submitting = false;
  private readonly roulette: PseudoRoulette;
  private unbindNav: (() => void) | null = null;

  constructor() {
    this.root = document.createElement("section");
    this.root.className = "identification-scene";

    const backButton = document.createElement("button");
    backButton.className = "identification-back-button";
    backButton.type = "button";
    backButton.setAttribute("aria-label", "Retour au menu");
    backButton.addEventListener("click", () =>
      dispatchIntent({ type: "BACK_TO_MENU" }, { sync: matchSync, store: gameStore }),
    );

    const backArrow = document.createElement("img");
    backArrow.src = "/images/cosmetics/Fleche.png";
    backArrow.alt = "";
    backArrow.setAttribute("aria-hidden", "true");
    backButton.appendChild(backArrow);
    this.root.appendChild(backButton);

    const card = document.createElement("div");
    card.className = "identification-card";
    this.root.appendChild(card);

    const title = document.createElement("h1");
    title.className = "identification-title";
    title.textContent = "Qui joue ?";
    card.appendChild(title);

    const subtitle = document.createElement("p");
    subtitle.className = "identification-subtitle";
    subtitle.textContent = "Choisis ton mode puis entre ton pseudo";
    card.appendChild(subtitle);

    // Saisie aux boutons de la borne (et flèches en dev) : roulette de lettres.
    // Le champ texte ci-dessous reste pour une saisie clavier rapide en dev.
    this.roulette = new PseudoRoulette({
      onComplete: (pseudo) => this.submitPseudo(pseudo),
      onCancel: () => dispatchIntent({ type: "BACK_TO_MENU" }, { sync: matchSync }),
    });
    this.roulette.mount(card);

    const modeRow = document.createElement("div");
    modeRow.className = "identification-modes";
    this.modeButtons = {
      solo: new Button({
        label: "Solo",
        variant: "primary",
        onClick: () => this.setMode("solo"),
      }),
      "1v1": new Button({
        label: "1 vs 1",
        variant: "ghost",
        onClick: () => this.setMode("1v1"),
      }),
    };
    this.modeButtons.solo.mount(modeRow);
    this.modeButtons["1v1"].mount(modeRow);
    card.appendChild(modeRow);

    this.playersContainer = document.createElement("div");
    this.playersContainer.className = "identification-players";
    card.appendChild(this.playersContainer);

    this.globalError = document.createElement("p");
    this.globalError.className = "identification-global-error";
    this.globalError.setAttribute("aria-live", "polite");
    card.appendChild(this.globalError);

    const actions = document.createElement("div");
    actions.className = "identification-actions";
    this.submitButton = new Button({
      label: "Lancer la partie",
      variant: "primary",
      disabled: true,
      onClick: () => void this.submit(),
    });
    this.submitButton.mount(actions);
    card.appendChild(actions);

    this.rebuildSlots();
  }

  mount(host: HTMLElement = document.body): void {
    host.appendChild(this.root);
    menuAudio.playMenu();
    this.slots[0]?.input.focus();
    // La roulette gère elle-même son `back` (effacer / annuler), donc cet écran
    // câble toute sa navigation borne (pas via `navScreen`).
    this.unbindNav = bindScreenNav(
      {
        left: () => this.roulette.moveChar(-1),
        right: () => this.roulette.moveChar(1),
        confirm: () => this.roulette.confirm(),
        back: () => this.roulette.back(),
      },
      { sync: matchSync, keyboard: true },
    );
  }

  unmount(): void {
    this.unbindNav?.();
    this.unbindNav = null;
    this.roulette.unmount();
    this.slots.forEach((s) => s.input.unmount());
    this.modeButtons.solo.unmount();
    this.modeButtons["1v1"].unmount();
    this.submitButton.unmount();
    this.root.remove();
  }

  /** Soumission depuis la roulette borne : pseudo solo déjà composé. */
  private submitPseudo(pseudo: string): void {
    if (this.submitting) return;
    const res = validatePseudo(pseudo);
    if (!res.ok) {
      this.setGlobalError(res.error);
      return;
    }
    this.submitting = true;
    this.submitButton.setLabel("Lancement...");
    this.submitButton.setDisabled(true);
    this.setGlobalError(null);
    matchSync.dispatch({
      type: "intent",
      action: "PLAYERS_VALIDATED",
      payload: { pseudo: res.normalized, mode: "solo", players: [res.normalized] },
    });
  }

  private setMode(mode: GameMode): void {
    if (this.mode === mode || this.submitting) return;
    this.mode = mode;
    this.modeButtons.solo.setVariant(mode === "solo" ? "primary" : "ghost");
    this.modeButtons["1v1"].setVariant(mode === "1v1" ? "primary" : "ghost");
    this.setGlobalError(null);
    this.rebuildSlots();
  }

  private rebuildSlots(): void {
    this.slots.forEach((s) => s.input.unmount());
    this.playersContainer.innerHTML = "";
    const count = this.mode === "1v1" ? 2 : 1;
    this.slots = [];
    for (let i = 0; i < count; i += 1) {
      const wrapper = document.createElement("div");
      wrapper.className = "identification-player-slot";
      const input = new PseudoInput({
        label: count === 1 ? "Pseudo" : `Joueur ${i + 1}`,
        onInput: () => this.recomputeReady(),
        onSubmit: () => void this.submit(),
      });
      input.mount(wrapper);
      this.playersContainer.appendChild(wrapper);
      this.slots.push({ input, validated: null });
    }
    this.recomputeReady();
  }

  private recomputeReady(): void {
    let allOk = true;
    for (const slot of this.slots) {
      const res = validatePseudo(slot.input.getValue());
      if (res.ok) {
        slot.input.setError(null);
        slot.validated = res.normalized;
      } else {
        slot.validated = null;
        allOk = false;
      }
    }
    this.submitButton.setDisabled(!allOk || this.submitting);
  }

  private submit(): void {
    if (this.submitting) return;

    const tags: PlayerTag[] = [];
    let firstError = true;
    for (const slot of this.slots) {
      const res = validatePseudo(slot.input.getValue());
      if (!res.ok) {
        slot.input.setError(res.error);
        if (firstError) {
          slot.input.focus();
          firstError = false;
        }
        this.submitButton.setDisabled(true);
        return;
      }
      slot.input.setError(null);
      tags.push(res.normalized);
    }

    this.submitting = true;
    this.submitButton.setLabel("Lancement...");
    this.submitButton.setDisabled(true);
    this.setGlobalError(null);

    const command = {
      type: "intent",
      action: "PLAYERS_VALIDATED",
      payload: { pseudo: tags[0], mode: this.mode, players: tags },
    } as const;

    savePlayerSession(this.mode, tags);

    if (!dispatchDevLocalCommand(command, gameStore)) {
      matchSync.dispatch(command);
    }
  }

  private setGlobalError(message: string | null): void {
    this.globalError.textContent = message ?? "";
    this.globalError.classList.toggle("identification-global-error--visible", !!message);
  }
}
