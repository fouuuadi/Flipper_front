import { MatchSyncAdapter, type MatchStatus, type WsServerEvent } from "@services/matchSync";
import { attachCountdownOverlay } from "@modules/countdown";
import { MatchTimer, formatElapsedMs } from "@modules/matchTimer";
import "./backglass.css";

const DEFAULT_LIVES = 3;

interface HudState {
  status: MatchStatus | "waiting-session";
  score: number;
  combo: number;
  lives: number;
  finalScore: number | null;
}

const INITIAL_STATE: HudState = {
  status: "waiting-session",
  score: 0,
  combo: 0,
  lives: DEFAULT_LIVES,
  finalScore: null,
};

/**
 * App backglass — affichage stable du score, des jauges et de l'état de partie.
 *
 * Pas de state machine locale, pas de saisie utilisateur. Le `match:state`
 * reçu via WS dicte directement ce qui est affiché. Tout ce qui touche au
 * gameplay (start, pause, abandon) est piloté par le playfield, qui pousse
 * les `cmd:*` au back ; le back rebroadcast l'état nouveau ici.
 */
export class BackglassApp {
  private readonly root: HTMLElement;
  private readonly statusEl: HTMLElement;
  private readonly scoreEl: HTMLElement;
  private readonly livesEl: HTMLElement;
  private readonly comboEl: HTMLElement;
  private readonly timerEl: HTMLElement;
  private readonly overlayEl: HTMLElement;
  private state: HudState = { ...INITIAL_STATE };
  private detachCountdown: (() => void) | null = null;
  private sync: MatchSyncAdapter | null = null;
  private readonly matchTimer = new MatchTimer();
  private unsubscribeTimer: (() => void) | null = null;

  constructor(host: HTMLElement) {
    this.root = document.createElement("section");
    this.root.className = "backglass-scene";

    const top = document.createElement("div");
    top.className = "backglass-top";
    this.statusEl = document.createElement("div");
    this.statusEl.className = "backglass-status";
    top.appendChild(this.statusEl);
    this.root.appendChild(top);

    const main = document.createElement("div");
    main.className = "backglass-main";

    const scoreLabel = document.createElement("div");
    scoreLabel.className = "backglass-label";
    scoreLabel.textContent = "Score";
    main.appendChild(scoreLabel);

    this.scoreEl = document.createElement("div");
    this.scoreEl.className = "backglass-score";
    main.appendChild(this.scoreEl);

    const gauges = document.createElement("div");
    gauges.className = "backglass-gauges";

    this.livesEl = document.createElement("div");
    this.livesEl.className = "backglass-gauge";
    this.comboEl = document.createElement("div");
    this.comboEl.className = "backglass-gauge";
    gauges.append(this.livesEl, this.comboEl);
    main.appendChild(gauges);

    this.timerEl = document.createElement("div");
    this.timerEl.className = "backglass-timer";
    this.timerEl.textContent = formatElapsedMs(0);
    main.appendChild(this.timerEl);
    this.root.appendChild(main);

    this.overlayEl = document.createElement("div");
    this.overlayEl.className = "backglass-overlay";
    this.root.appendChild(this.overlayEl);

    host.appendChild(this.root);
    this.render();
  }

  /**
   * Démarre l'app : lit le `session_id` depuis l'URL, connecte le matchSync
   * et abonne le rendu aux events. Sans `session_id`, reste sur l'écran
   * d'attente jusqu'à ce que l'utilisateur recharge avec le bon paramètre.
   */
  start(): void {
    const params = new URLSearchParams(window.location.search);
    const sessionId = params.get("session_id");
    if (!sessionId) {
      this.state = { ...INITIAL_STATE, status: "waiting-session" };
      this.render();
      return;
    }

    this.sync = new MatchSyncAdapter();
    this.detachCountdown = attachCountdownOverlay(this.sync, this.root);
    this.sync.onEvent((event) => this.handleEvent(event));
    this.sync.connect(sessionId);
    // En attendant le 1er match:state broadcast, on affiche "Connecté…".
    this.state = { ...INITIAL_STATE, status: "waiting" };
    this.unsubscribeTimer = this.matchTimer.subscribe((elapsed) => {
      this.timerEl.textContent = formatElapsedMs(elapsed);
    });
    this.render();
  }

  stop(): void {
    this.detachCountdown?.();
    this.detachCountdown = null;
    this.unsubscribeTimer?.();
    this.unsubscribeTimer = null;
    this.matchTimer.reset();
    this.sync?.disconnect();
    this.sync = null;
  }

  private handleEvent(event: WsServerEvent): void {
    if (event.type === "match:state") {
      this.syncTimerToStatus(event.status, this.state.status);
      this.state = {
        ...this.state,
        status: event.status,
        // Reset des jauges quand la partie redémarre vraiment (ready → playing).
        ...(event.status === "playing" && this.state.status !== "paused"
          ? { score: 0, combo: 0, lives: DEFAULT_LIVES, finalScore: null }
          : {}),
      };
      this.render();
      return;
    }
    if (event.type === "score:update") {
      this.state = { ...this.state, score: event.score, combo: event.combo };
      this.render();
      return;
    }
    if (event.type === "ball:lost") {
      this.state = {
        ...this.state,
        lives: event.livesRemaining,
        combo: 0,
      };
      this.render();
      return;
    }
    if (event.type === "game:over") {
      this.state = { ...this.state, finalScore: event.finalScore };
      this.render();
      return;
    }
    // countdown:tick traité par l'overlay countdown.
  }

  private syncTimerToStatus(next: MatchStatus, prev: HudState["status"]): void {
    const phase = this.matchTimer.getPhase();
    if (next === "playing") {
      // Première entrée en playing OU sortie de pause via le countdown back
      if (phase === "idle") this.matchTimer.start();
      else if (phase === "frozen") this.matchTimer.unfreeze();
    } else if (next === "paused") {
      if (phase === "running") this.matchTimer.freeze();
    } else if (next === "over") {
      if (phase === "running" || phase === "frozen") this.matchTimer.stop();
    } else if (next === "ready" || next === "waiting") {
      // Si on retombe en attente après une partie (ex: nouvelle session sur la
      // même tab), on reset pour repartir à 00:00.
      if (phase !== "idle" && prev !== "ready" && prev !== "waiting") {
        this.matchTimer.reset();
      }
    }
  }

  private render(): void {
    this.statusEl.textContent = this.statusLabel();
    this.scoreEl.textContent = this.state.score.toString().padStart(6, "0");
    this.livesEl.textContent = `Vies ${"●".repeat(this.state.lives)}${"○".repeat(
      Math.max(0, DEFAULT_LIVES - this.state.lives),
    )}`;
    this.comboEl.textContent = this.state.combo > 0 ? `x${this.state.combo} combo` : "";

    this.overlayEl.innerHTML = "";
    if (this.state.status === "waiting-session") {
      this.renderOverlayMessage(
        "En attente de session",
        "Ouvre cet écran avec ?session_id=… dans l'URL",
      );
    } else if (this.state.status === "waiting" || this.state.status === "ready") {
      this.renderOverlayMessage("Prêt", "La partie va commencer…");
    } else if (this.state.status === "paused") {
      this.renderOverlayMessage("Pause", "");
    } else if (this.state.status === "over") {
      const final = this.state.finalScore ?? this.state.score;
      this.renderOverlayMessage("Game Over", `Score final : ${final}`);
    }
  }

  private statusLabel(): string {
    switch (this.state.status) {
      case "waiting-session":
        return "Déconnecté";
      case "waiting":
        return "Connexion…";
      case "ready":
        return "Prêt";
      case "playing":
        return "En partie";
      case "paused":
        return "Pause";
      case "over":
        return "Terminé";
    }
  }

  private renderOverlayMessage(title: string, subtitle: string): void {
    const wrap = document.createElement("div");
    wrap.className = "backglass-overlay-card";
    const t = document.createElement("h1");
    t.className = "backglass-overlay-title";
    t.textContent = title;
    wrap.appendChild(t);
    if (subtitle) {
      const s = document.createElement("p");
      s.className = "backglass-overlay-subtitle";
      s.textContent = subtitle;
      wrap.appendChild(s);
    }
    this.overlayEl.appendChild(wrap);
  }
}
