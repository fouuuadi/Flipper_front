import { env } from "@config/env";

export class WebSocketService {
  private reconnectTimeout: ReturnType<typeof setTimeout> | null = null;
  private readonly reconnectDelay: number = 3000;
  private socket: WebSocket | null = null;
  private readonly url: string;

  constructor(url: string = env.wsUrl) {
    this.url = url;
  }

  connect(): void {
    if (this.socket) return;
    this.socket = new WebSocket(this.url);

    this.socket.addEventListener("open", () => {
      console.log(`[WebSocket] Connecté à ${this.url}`);
    });

    this.socket.addEventListener("close", () => {
      console.log(`[WebSocket] Déconnecté de ${this.url}`);
      this.socket = null;

      this.reconnectTimeout = setTimeout(() => {
        console.log(`[WebSocket] Tentative de reconnexion...`);
        this.connect();
      }, this.reconnectDelay);
    });

    this.socket.addEventListener("message", (event) => {
      console.log(`[WebSocket] Message reçu :`, event.data);
    });
  }

  disconnect(): void {
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }
    if (!this.socket) return;
    this.socket.close();
    this.socket = null;
  }
}
