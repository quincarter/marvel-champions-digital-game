/** `ws` ships no types and `@types/ws` is not installed; the live-room fixture uses only this much of it. */
declare module "ws" {
  export class WebSocket {
    constructor(url: string);
    readyState: number;
    send(data: string): void;
    close(code?: number, reason?: string): void;
    on(event: "message", listener: (data: { toString(): string }) => void): this;
    on(event: "close", listener: () => void): this;
    on(event: "open", listener: () => void): this;
    on(event: "error", listener: (error: Error) => void): this;
  }
  export class WebSocketServer {
    constructor(options: { noServer: true });
    handleUpgrade(request: unknown, socket: unknown, head: unknown, callback: (ws: WebSocket) => void): void;
  }
}
