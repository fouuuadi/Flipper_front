import { Button } from "@modules/ui";
import { gameStore } from "@core/gameStore";
import { dispatchIntent } from "@core/keyboardDispatcher";
import { matchSync } from "@services/matchSync";
import type { GameMode } from "@core/gameMachine.types";
import { menuAudio } from "@services/menuAudio";
import {
  HttpLeaderboardStore,
  type LeaderboardEntry,
  type LeaderboardStore,
} from "@services/leaderboardStore";
import "./leaderboard.css";

type ViewState =
  | { readonly kind: "loading" }
  | { readonly kind: "empty" }
  | { readonly kind: "loaded"; readonly entries: ReadonlyArray<LeaderboardEntry> }
  | { readonly kind: "error"; readonly message: string };

const DEFAULT_LIMIT = 12;

/**
 * Écran leaderboard.
 *
 * Toggle solo / 1v1 (state UI local). Les scores sont rechargés via le store
 * injecté à chaque changement d'onglet — pas de cache côté composant, le store
 * fait foi (cf. #81).
 *
 * À l'entrée, ouvre sur l'onglet correspondant au `context.mode` de la SM
 * (utile si on arrive depuis gameOver) ; fallback "solo".
 */
export class Leaderboard {
  private readonly root: HTMLElement;
  private readonly tabsEl: HTMLElement;
  private readonly listEl: HTMLElement;
  private readonly backButton: Button;
  private readonly tabButtons: { solo: Button; "1v1": Button };
  private readonly store: LeaderboardStore;
  private mode: GameMode = "solo";

  constructor(store: LeaderboardStore = new HttpLeaderboardStore()) {
    this.store = store;

    this.root = document.createElement("section");
    this.root.className = "leaderboard-scene";

    const spotlight = document.createElement("div");
    spotlight.className = "leaderboard-spotlight";
    spotlight.setAttribute("aria-hidden", "true");
    this.root.appendChild(spotlight);

    const card = document.createElement("div");
    card.className = "leaderboard-card";
    this.root.appendChild(card);

    const title = document.createElement("h1");
    title.className = "leaderboard-title";
    title.textContent = "Classement";
    card.appendChild(title);

    this.tabsEl = document.createElement("div");
    this.tabsEl.className = "leaderboard-tabs";
    this.tabButtons = {
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
    this.tabButtons.solo.mount(this.tabsEl);
    this.tabButtons["1v1"].mount(this.tabsEl);
    card.appendChild(this.tabsEl);

    this.listEl = document.createElement("div");
    this.listEl.className = "leaderboard-list";
    this.listEl.setAttribute("aria-live", "polite");
    card.appendChild(this.listEl);

    const actions = document.createElement("div");
    actions.className = "leaderboard-actions";
    this.backButton = new Button({
      label: "Retour menu",
      variant: "ghost",
      onClick: () =>
        dispatchIntent({ type: "BACK_TO_MENU" }, { sync: matchSync, store: gameStore }),
    });
    this.backButton.mount(actions);
    card.appendChild(actions);
  }

  mount(host: HTMLElement = document.body): void {
    host.appendChild(this.root);
    menuAudio.playMenu();
    // Onglet par défaut = mode joué le plus récemment (si on arrive de gameOver).
    const ctxMode = gameStore.getState().context.mode;
    this.setMode(ctxMode ?? "solo");
  }

  unmount(): void {
    this.tabButtons.solo.unmount();
    this.tabButtons["1v1"].unmount();
    this.backButton.unmount();
    this.root.remove();
  }

  /** Bascule l'onglet solo ↔ 1v1 (boutons borne gauche/droite). */
  toggleMode(): void {
    this.setMode(this.mode === "solo" ? "1v1" : "solo");
  }

  private setMode(mode: GameMode): void {
    this.mode = mode;
    this.tabButtons.solo.setVariant(mode === "solo" ? "primary" : "ghost");
    this.tabButtons["1v1"].setVariant(mode === "1v1" ? "primary" : "ghost");
    void this.reload();
  }

  private async reload(): Promise<void> {
    const requestedMode = this.mode;
    this.render({ kind: "loading" });
    try {
      const entries = await this.store.list({ mode: requestedMode, limit: DEFAULT_LIMIT });
      // Le toggle a pu changer pendant le fetch : on ignore les résultats périmés.
      if (this.mode !== requestedMode) return;
      this.render(entries.length === 0 ? { kind: "empty" } : { kind: "loaded", entries });
    } catch (err) {
      if (this.mode !== requestedMode) return;
      this.render({
        kind: "error",
        message: err instanceof Error ? err.message : "Erreur inconnue",
      });
    }
  }

  private render(state: ViewState): void {
    this.listEl.innerHTML = "";
    switch (state.kind) {
      case "loading":
        this.appendMessage("Chargement…");
        return;
      case "empty":
        this.appendMessage("Aucun score enregistré pour ce mode");
        return;
      case "error":
        this.appendMessage(`Erreur de chargement : ${state.message}`, "leaderboard-empty--error");
        return;
      case "loaded":
        this.appendHeader();
        state.entries.forEach((entry) => this.appendRow(entry));
        return;
    }
  }

  private appendMessage(text: string, modifier?: string): void {
    const p = document.createElement("p");
    p.className = "leaderboard-empty";
    if (modifier) p.classList.add(modifier);
    p.textContent = text;
    this.listEl.appendChild(p);
  }

  private appendHeader(): void {
    const header = document.createElement("div");
    header.className = "leaderboard-row leaderboard-row--header";

    const rank = document.createElement("span");
    rank.className = "leaderboard-rank";
    rank.textContent = "#";
    header.appendChild(rank);

    const avatar = document.createElement("span");
    avatar.className = "leaderboard-avatar";
    avatar.textContent = "";
    header.appendChild(avatar);

    const pseudo = document.createElement("span");
    pseudo.className = "leaderboard-pseudo";
    pseudo.textContent = "Joueur";
    header.appendChild(pseudo);

    const score = document.createElement("span");
    score.className = "leaderboard-score";
    score.textContent = "Score";
    header.appendChild(score);

    this.listEl.appendChild(header);
  }

  private appendRow(entry: LeaderboardEntry): void {
    const row = document.createElement("div");
    row.className = "leaderboard-row";
    if (entry.rank === 1) row.classList.add("leaderboard-row--first");
    if (entry.rank === 2) row.classList.add("leaderboard-row--second");
    if (entry.rank === 3) row.classList.add("leaderboard-row--third");

    const rank = document.createElement("span");
    rank.className = "leaderboard-rank";
    rank.textContent = String(entry.rank);
    row.appendChild(rank);

    const avatar = document.createElement("span");
    avatar.className = "leaderboard-avatar";
    avatar.setAttribute("aria-hidden", "true");
    avatar.textContent = this.avatarForRank(entry.rank);
    row.appendChild(avatar);

    const pseudo = document.createElement("span");
    pseudo.className = "leaderboard-pseudo";
    pseudo.textContent = entry.pseudo;
    row.appendChild(pseudo);

    const score = document.createElement("span");
    score.className = "leaderboard-score";
    score.textContent = String(entry.score);
    row.appendChild(score);

    this.listEl.appendChild(row);
  }

  private avatarForRank(rank: number): string {
    if (rank === 1) return "M";
    if (rank === 2) return "L";
    if (rank === 3) return "S";
    return "★";
  }
}
