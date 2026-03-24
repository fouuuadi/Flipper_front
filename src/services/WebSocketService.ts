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
  }

  disconnect(): void {
    if (!this.socket) return;
    this.socket.close();
    this.socket = null;
  }
}