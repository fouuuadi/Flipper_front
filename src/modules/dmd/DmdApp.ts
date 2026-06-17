import type { MatchSyncAdapter, WsServerEvent } from "@services/matchSync";
import "./dmd.css";

type DmdMessage = {
  readonly text: string;
  /** Plus haute priorité = remplace le message courant. */
  readonly priority: number;
  /** Durée d'affichage en ms ; null = persistant jusqu'au prochain message. */
  readonly durationMs: number | null;
};

const STATUS_IDLE: DmdMessage = {
  text: "FLIPHETIC",
  priority: 0,
  durationMs: null,
};
const STATUS_READY: DmdMessage = { text: "READY", priority: 5, durationMs: null };
const STATUS_PAUSED: DmdMessage = { text: "PAUSED", priority: 30, durationMs: null };
const STATUS_OVER: DmdMessage = { text: "GAME OVER", priority: 40, durationMs: null };

/**
 * App DMD (Dot Matrix Display) — affichage minimaliste de messages courts.
 *
 * Read-only sur le WS. Queue de messages avec priorités :
 *   - les events ponctuels (`score:update`, `ball:lost`, `countdown:tick`)
 *     poussent un message à durée limitée
 *   - les transitions de session (`match:state`) installent un message
 *     persistant que la queue ne peut pas écraser sans priorité supérieure
 *
 * Le rendu reste du DOM stylisé en pixel art via CSS — pas de canvas
 * complet, qui sera l'objet de #83 si on veut pousser plus loin.
 */
export class DmdApp {
  private readonly root: HTMLElement;
  private readonly screen: HTMLElement;
  private currentPersistent: DmdMessage = STATUS_IDLE;
  private transientTimer: ReturnType<typeof setTimeout> | null = null;
  private unsubscribe: (() => void) | null = null;

  constructor(host: HTMLElement) {
    this.root = document.createElement("section");
    this.root.className = "dmd-scene";

    const frame = document.createElement("div");
    frame.className = "dmd-frame";
    this.screen = document.createElement("div");
    this.screen.className = "dmd-screen";
    this.screen.setAttribute("aria-live", "polite");
    frame.appendChild(this.screen);
    this.root.appendChild(frame);
    host.appendChild(this.root);

    this.renderMessage(STATUS_IDLE);
  }

  /** Démarre l'affichage sur le bus borne partagé (connecté au boot). */
  start(sync: MatchSyncAdapter): void {
    this.unsubscribe = sync.onEvent((event) => this.handleEvent(event));
    this.setPersistent(STATUS_IDLE);
  }

  stop(): void {
    if (this.transientTimer) {
      clearTimeout(this.transientTimer);
      this.transientTimer = null;
    }
    // Bus borne partagé : on ne déconnecte pas, on retire juste notre abonnement.
    this.unsubscribe?.();
    this.unsubscribe = null;
  }

  private handleEvent(event: WsServerEvent): void {
    if (event.type === "nav:state") {
      // Hors partie → écran d'attente. En `in_game`/`game_over`, on laisse les
      // match:state / score / countdown piloter l'affichage.
      if (event.nav !== "in_game" && event.nav !== "game_over") {
        this.setPersistent(STATUS_IDLE);
      }
      return;
    }
    if (event.type === "match:state") {
      switch (event.status) {
        case "waiting":
        case "ready":
          this.setPersistent(STATUS_READY);
          return;
        case "playing":
          this.setPersistent({ text: "0", priority: 10, durationMs: null });
          return;
        case "paused":
          this.setPersistent(STATUS_PAUSED);
          return;
        case "over":
          this.setPersistent(STATUS_OVER);
          return;
      }
    }
    if (event.type === "countdown:tick") {
      // 1100 ms > l'intervalle back (1 s) pour qu'un tick reste affiché
      // jusqu'au suivant — sinon le persistent (`READY`) flashe entre 2 ticks.
      this.pushTransient({
        text: event.value === 0 ? "GO!" : String(event.value),
        priority: 50,
        durationMs: 1100,
      });
      return;
    }
    if (event.type === "score:update") {
      this.setPersistent({
        text: event.score.toString(),
        priority: 10,
        durationMs: null,
      });
      if (event.combo > 1) {
        this.pushTransient({
          text: `COMBO x${event.combo}`,
          priority: 25,
          durationMs: 800,
        });
      }
      return;
    }
    if (event.type === "ball:lost") {
      this.pushTransient({
        text: "BALL LOST",
        priority: 25,
        durationMs: 1000,
      });
      return;
    }
    // game:over → on garde le score persistant ; match:state: over arrive
    // dans la foulée et installera "GAME OVER".
  }

  private setPersistent(message: DmdMessage): void {
    this.currentPersistent = message;
    if (!this.transientTimer) this.renderMessage(message);
  }

  private pushTransient(message: DmdMessage): void {
    if (this.transientTimer) clearTimeout(this.transientTimer);
    this.renderMessage(message);
    if (message.durationMs !== null) {
      this.transientTimer = setTimeout(() => {
        this.transientTimer = null;
        this.renderMessage(this.currentPersistent);
      }, message.durationMs);
    }
  }

  private renderMessage(message: DmdMessage): void {
    this.screen.textContent = message.text;
  }
}
