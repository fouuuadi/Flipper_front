import { env } from "@config/env";

export class WebSocketService {
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
    });

    this.socket.addEventListener("message", (event) => {
      console.log(`[WebSocket] Message reçu :`, event.data);
    });
  }

  disconnect(): void {
    if (!this.socket) return;
    this.socket.close();
    this.socket = null;
    
  }
}