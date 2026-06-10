import { env } from "@config/env";
import { isServerEvent, type ClientCommand, type WsServerEvent } from "./protocol";

/**
 * Pont WebSocket entre les apps front et le back, pour le protocole MATCH_SYNC.
 *
 * Cycle de vie :
 *   - `connect(sessionId)` ouvre `ws/?session_id=...`
 *   - reçoit `WsServerEvent` → notifie les abonnés via `onEvent`
 *   - `dispatch(cmd)` envoie une `ClientCommand` JSON
 *   - `disconnect()` ferme la socket et désactive la reconnexion auto
 *
 * Résilience :
 *   - reconnexion exponentielle (1s → 2s → 4s → 8s → 16s → 30s plafond)
 *   - les `dispatch` envoyés avant que la socket soit `OPEN` sont mis en file
 *     d'attente et flushés à l'ouverture
 *   - les events serveur non reconnus sont ignorés (log debug)
 *
 * Le mapping vers `gameStore` n'est pas la responsabilité de cet adapter.
 * Les consommateurs (`Pause`, `GameOver`, futur HUD…) s'abonnent via
 * `onEvent` et décident eux-mêmes quoi faire (cf. issue #97).
 */
export class MatchSyncAdapter {
  private socket: WebSocket | null = null;
  private sessionId: string | null = null;
  private reconnectAttempts = 0;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private intentionalDisconnect = false;
  private readonly pendingDispatch: ClientCommand[] = [];
  private readonly listeners = new Set<(event: WsServerEvent) => void>();
  private readonly socketFactory: (url: string) => WebSocket;
  private readonly baseWsUrl: string;

  constructor(
    options: {
      readonly baseWsUrl?: string;
      readonly socketFactory?: (url: string) => WebSocket;
    } = {},
  ) {
    this.baseWsUrl = options.baseWsUrl ?? env.wsUrl;
    this.socketFactory = options.socketFactory ?? ((url) => new WebSocket(url));
  }

  /** Ouvre la connexion WS pour la session donnée. */
  connect(sessionId: string): void {
    if (this.sessionId === sessionId && this.socket) return;
    this.disconnect();
    this.sessionId = sessionId;
    this.intentionalDisconnect = false;
    this.openSocket();
  }

  /** Coupe la connexion proprement et désactive l'auto-reconnect. */
  disconnect(): void {
    this.intentionalDisconnect = true;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.socket) {
      this.socket.close();
      this.socket = null;
    }
    this.sessionId = null;
    this.reconnectAttempts = 0;
    this.pendingDispatch.length = 0;
  }

  /**
   * Envoie une commande au back. Si la socket n'est pas encore ouverte,
   * la commande est mise en file et flushée à l'ouverture.
   */
  dispatch(command: ClientCommand): void {
    if (this.socket && this.socket.readyState === WebSocket.OPEN) {
      this.socket.send(JSON.stringify(command));
      return;
    }
    this.pendingDispatch.push(command);
  }

  /** Abonne un consommateur aux events serveur. Retourne un unsubscribe. */
  onEvent(handler: (event: WsServerEvent) => void): () => void {
    this.listeners.add(handler);
    return () => {
      this.listeners.delete(handler);
    };
  }

  // ─── internals ────────────────────────────────────────────────────────

  private openSocket(): void {
    if (!this.sessionId) return;
    const url = `${this.baseWsUrl}?session_id=${encodeURIComponent(this.sessionId)}`;
    const socket = this.socketFactory(url);
    this.socket = socket;

    socket.addEventListener("open", () => {
      this.reconnectAttempts = 0;
      this.flushPending();
    });

    socket.addEventListener("message", (event) => {
      this.handleRawMessage(event.data);
    });

    socket.addEventListener("close", () => {
      this.socket = null;
      if (!this.intentionalDisconnect && this.sessionId) {
        this.scheduleReconnect();
      }
    });

    socket.addEventListener("error", () => {
      // Le close suivra ; on laisse la logique de reconnect s'en charger.
    });
  }

  private handleRawMessage(raw: unknown): void {
    if (typeof raw !== "string") return;
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      return;
    }
    if (!isServerEvent(parsed)) return;
    for (const listener of this.listeners) {
      listener(parsed);
    }
  }

  private flushPending(): void {
    if (!this.socket || this.socket.readyState !== WebSocket.OPEN) return;
    while (this.pendingDispatch.length > 0) {
      const cmd = this.pendingDispatch.shift();
      if (cmd) this.socket.send(JSON.stringify(cmd));
    }
  }

  private scheduleReconnect(): void {
    // Plafonds : 1, 2, 4, 8, 16, 30s — pas plus.
    const delay = Math.min(2 ** this.reconnectAttempts * 1000, 30_000);
    this.reconnectAttempts += 1;
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.openSocket();
    }, delay);
  }
}
