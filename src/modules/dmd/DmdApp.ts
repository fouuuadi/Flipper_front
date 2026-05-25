import { MatchSyncAdapter, type WsServerEvent } from "@services/matchSync";
import "./dmd.css";

type DmdMessage = {
  readonly text: string;
  /** Plus haute priorité = remplace le message courant. */
  readonly priority: number;
  /** Durée d'affichage en ms ; null = persistant jusqu'au prochain message. */
  readonly durationMs: number | null;
};

const STATUS_DISCONNECTED: DmdMessage = {
  text: "WAITING SESSION",
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
  private currentPersistent: DmdMessage = STATUS_DISCONNECTED;
  private transientTimer: ReturnType<typeof setTimeout> | null = null;
  private sync: MatchSyncAdapter | null = null;

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

    this.renderMessage(STATUS_DISCONNECTED);
  }

  start(): void {
    const params = new URLSearchParams(window.location.search);
    const sessionId = params.get("session_id");
    if (!sessionId) {
      this.setPersistent(STATUS_DISCONNECTED);
      return;
    }
    this.sync = new MatchSyncAdapter();
    this.sync.onEvent((event) => this.handleEvent(event));
    this.sync.connect(sessionId);
    this.setPersistent({ text: "CONNECTING", priority: 1, durationMs: null });
  }

  stop(): void {
    if (this.transientTimer) {
      clearTimeout(this.transientTimer);
      this.transientTimer = null;
    }
    this.sync?.disconnect();
    this.sync = null;
  }

  private handleEvent(event: WsServerEvent): void {
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
