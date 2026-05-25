import { Button, Input } from "@modules/ui";
import { gameStore } from "@core/gameStore";
import type { GameMode, PlayerTag } from "@core/gameMachine.types";
import { bindMatchSyncToGameStore, matchSync } from "@services/matchSync";
import { ApiError, createSession, readySession } from "./api";
import { validatePseudo } from "./validation";
import "./identification.css";

interface PlayerSlot {
  readonly input: Input;
  validated: PlayerTag | null;
}

/**
 * Écran d'identification des joueurs (solo / 1v1).
 *
 * Solo : 1 input → POST /sessions + /ready → emit PLAYERS_VALIDATED.
 * 1v1  : 2 inputs séquentiels → emit PLAYERS_VALIDATED (mock back, cf. #59 back).
 *
 * Le composant lit la SM uniquement pour vérifier qu'on est en état `identification`
 * et envoie l'event `PLAYERS_VALIDATED` à la sortie. Aucun état parallèle.
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

  constructor() {
    this.root = document.createElement("section");
    this.root.className = "identification-scene";

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
    this.slots[0]?.input.focus();
  }

  unmount(): void {
    this.slots.forEach((s) => s.input.unmount());
    this.modeButtons.solo.unmount();
    this.modeButtons["1v1"].unmount();
    this.submitButton.unmount();
    this.root.remove();
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
      const input = new Input({
        label: count === 1 ? "Pseudo" : `Joueur ${i + 1}`,
        placeholder: "ABC",
        maxLength: 9,
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
        // Pas d'erreur affichée tant que l'utilisateur n'a pas tenté de soumettre.
        slot.validated = null;
        allOk = false;
      }
    }
    this.submitButton.setDisabled(!allOk || this.submitting);
  }

  private async submit(): Promise<void> {
    if (this.submitting) return;

    // Validation finale avant network : on affiche les erreurs cette fois.
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
    this.submitButton.setLabel("Connexion…");
    this.submitButton.setDisabled(true);
    this.setGlobalError(null);

    try {
      if (this.mode === "solo") {
        const session = await createSession({
          pseudo: tags[0],
          mode: "solo",
          room_code: null,
        });
        await readySession(session.session_id);
        // Ouvre le WS et branche les events match:state sur la SM avant la
        // transition, pour qu'un pause/abandon arrivant dans la milliseconde
        // qui suit ne soit pas perdu.
        bindMatchSyncToGameStore(matchSync, gameStore);
        matchSync.connect(session.session_id);
        // Le serveur normalise le pseudo — on remplace par sa valeur de vérité.
        gameStore.send({
          type: "PLAYERS_VALIDATED",
          mode: "solo",
          players: [session.pseudo as PlayerTag],
          sessionId: session.session_id,
        });
      } else {
        // 1v1 : matchmaking back pas dispo (issue #59 back). Mock front,
        // pas de session backend → pas de WS à ouvrir, sessionId null.
        gameStore.send({
          type: "PLAYERS_VALIDATED",
          mode: "1v1",
          players: tags,
          sessionId: null,
        });
      }
    } catch (err) {
      this.setGlobalError(this.formatError(err));
      this.submitButton.setLabel("Lancer la partie");
      this.submitting = false;
      this.recomputeReady();
    }
  }

  private formatError(err: unknown): string {
    if (err instanceof ApiError) {
      const reqId = err.requestId ? ` [reqId: ${err.requestId}]` : "";
      if (err.status === 404) return `Session introuvable. Réessaie.${reqId}`;
      if (err.code === "ValidationError" || err.code === "InvalidPseudoError") {
        return `Pseudo refusé par le serveur : ${err.message}${reqId}`;
      }
      return `Erreur serveur (${err.status}) : ${err.message}${reqId}`;
    }
    return "Connexion impossible. Vérifie que le serveur tourne.";
  }

  private setGlobalError(message: string | null): void {
    this.globalError.textContent = message ?? "";
    this.globalError.classList.toggle("identification-global-error--visible", !!message);
  }
}
