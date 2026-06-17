import { Button } from "@modules/ui";
import { gameStore } from "@core/gameStore";
import type { MachineSnapshot, Player } from "@core/gameMachine.types";
import { matchSync } from "@services/matchSync";
import { dispatchIntent } from "@core/keyboardDispatcher";
import { formatElapsedMs } from "@modules/matchTimer";
import { LocalStorageLeaderboardStore, type LeaderboardStore } from "@services/leaderboardStore";
import { pickWinner } from "./winner";
import "./gameOver.css";

/**
 * Écran fin de partie.
 *
 * La persistance en base est faite **automatiquement par le backend** au game
 * over (plus de `POST /scores` ici → pas de double écriture). On conserve
 * uniquement une copie locale (LocalStorageLeaderboardStore) pour le
 * leaderboard offline en dev.
 *
 * Les actions (REPLAY / BACK_TO_MENU / OPEN_LEADERBOARD) sont des **intentions**
 * envoyées au backend sur le bus borne, qui décide la navigation.
 */
export class GameOver {
  private readonly root: HTMLElement;
  private readonly statusEl: HTMLElement;
  private readonly summaryEl: HTMLElement;
  private readonly durationEl: HTMLElement;
  private readonly recordEl: HTMLElement;
  private readonly errorEl: HTMLElement;
  private readonly replayButton: Button;
  private readonly leaderboardButton: Button;
  private readonly menuButton: Button;
  private readonly localStore: LeaderboardStore;

  constructor(localStore: LeaderboardStore = new LocalStorageLeaderboardStore()) {
    this.localStore = localStore;

    this.root = document.createElement("section");
    this.root.className = "gameover-scene";

    const card = document.createElement("div");
    card.className = "gameover-card";
    this.root.appendChild(card);

    const title = document.createElement("h1");
    title.className = "gameover-title";
    title.textContent = "Partie terminée";
    card.appendChild(title);

    this.statusEl = document.createElement("p");
    this.statusEl.className = "gameover-status";
    this.statusEl.setAttribute("aria-live", "polite");
    this.statusEl.textContent = "Sauvegarde du score…";
    card.appendChild(this.statusEl);

    this.summaryEl = document.createElement("div");
    this.summaryEl.className = "gameover-summary";
    card.appendChild(this.summaryEl);

    this.durationEl = document.createElement("p");
    this.durationEl.className = "gameover-duration";
    card.appendChild(this.durationEl);

    this.recordEl = document.createElement("p");
    this.recordEl.className = "gameover-record";
    card.appendChild(this.recordEl);

    this.errorEl = document.createElement("p");
    this.errorEl.className = "gameover-error";
    this.errorEl.setAttribute("aria-live", "polite");
    card.appendChild(this.errorEl);

    const actions = document.createElement("div");
    actions.className = "gameover-actions";

    this.replayButton = new Button({
      label: "Rejouer",
      variant: "primary",
      onClick: () => this.leaveGameSession({ type: "REPLAY" }),
    });
    this.leaderboardButton = new Button({
      label: "Leaderboard",
      variant: "ghost",
      onClick: () => this.leaveGameSession({ type: "OPEN_LEADERBOARD" }),
    });
    this.menuButton = new Button({
      label: "Menu",
      variant: "ghost",
      onClick: () => this.leaveGameSession({ type: "BACK_TO_MENU" }),
    });
    this.replayButton.mount(actions);
    this.leaderboardButton.mount(actions);
    this.menuButton.mount(actions);
    card.appendChild(actions);
  }

  mount(host: HTMLElement = document.body): void {
    host.appendChild(this.root);
    // L'orchestrateur dans `src/main.ts` dispatche `SET_FINAL_DURATION` quand
    // il stoppe le MatchTimer juste après la transition vers gameOver. Cet
    // event ne change pas d'état mais patche `finalDurationMs`. On lit donc
    // l'état une 1re fois pour le rendu initial (durée encore null possible),
    // puis on s'abonne au store pour re-render dès que la durée arrive.
    const snapshot = gameStore.getState();
    this.renderSummary(snapshot);
    this.renderDuration(snapshot);
    const unsubscribe = gameStore.subscribe((snap) => {
      if (snap.value !== "gameOver") {
        unsubscribe();
        return;
      }
      this.renderDuration(snap);
    });
    void this.persist(snapshot);
  }

  unmount(): void {
    this.replayButton.unmount();
    this.leaderboardButton.unmount();
    this.menuButton.unmount();
    this.root.remove();
  }

  /**
   * Envoie l'intention de navigation au backend. On ne déconnecte JAMAIS
   * `matchSync` : c'est le bus borne partagé et permanent (le déconnecter
   * casserait les 3 écrans). Le backend décide la transition et la rebroadcast.
   */
  private leaveGameSession(event: { type: "REPLAY" | "OPEN_LEADERBOARD" | "BACK_TO_MENU" }): void {
    dispatchIntent(event, { sync: matchSync });
  }

  private renderSummary(snapshot: MachineSnapshot): void {
    const { mode, players } = snapshot.context;
    this.summaryEl.innerHTML = "";

    if (mode === "1v1" && players.length >= 2) {
      const verdict = pickWinner(players);
      players.forEach((p) => {
        const isWinner = verdict.kind === "winner" && verdict.player.tag === p.tag;
        this.summaryEl.appendChild(this.renderPlayerLine(p, isWinner));
      });
      if (verdict.kind === "draw") {
        const draw = document.createElement("p");
        draw.className = "gameover-verdict";
        draw.textContent = "Égalité parfaite";
        this.summaryEl.appendChild(draw);
      }
      return;
    }

    // Solo (ou fallback 1v1 incomplet).
    const solo = players[0];
    if (!solo) return;
    this.summaryEl.appendChild(this.renderPlayerLine(solo, false));
  }

  private renderDuration(snapshot: MachineSnapshot): void {
    const ms = snapshot.context.finalDurationMs;
    if (ms === null) {
      this.durationEl.textContent = "";
      return;
    }
    this.durationEl.textContent = `Durée : ${formatElapsedMs(ms)}`;
  }

  private renderPlayerLine(player: Player, isWinner: boolean): HTMLElement {
    const row = document.createElement("div");
    row.className = "gameover-player";
    if (isWinner) row.classList.add("gameover-player--winner");

    const tag = document.createElement("span");
    tag.className = "gameover-player-tag";
    tag.textContent = player.tag;
    row.appendChild(tag);

    const score = document.createElement("span");
    score.className = "gameover-player-score";
    score.textContent = String(player.score);
    row.appendChild(score);

    return row;
  }

  private async persist(snapshot: MachineSnapshot): Promise<void> {
    const { mode, players } = snapshot.context;
    if (!mode || players.length === 0) {
      this.statusEl.textContent = "";
      return;
    }

    // Copie locale uniquement (leaderboard offline en dev). La persistance DB
    // est faite par le backend au game over — aucun POST /scores ici.
    try {
      await Promise.all(
        players.map((p) =>
          this.localStore.save({
            mode,
            playerId: null,
            pseudo: p.tag,
            score: p.score,
          }),
        ),
      );
    } catch {
      // localStorage saturé / désactivé : on ne bloque pas l'écran pour ça.
    }

    this.statusEl.textContent = "Score sauvegardé";
    this.recordEl.textContent = "";
  }
}
