/**
 * A WebSocket client for one game room on the sync Worker (docs/live-game-rooms.md, `room-protocol.ts`), and the
 * `POST /room` call that makes a room. Plain TypeScript with the WebSocket constructor, timers and random source
 * injected, so it runs in a worker (the host's `live-room.worker.ts`), in a future watcher, and in tests.
 *
 * The socket says hello as soon as it opens and reports "connected" once the room's `welcome` arrives (only then may
 * game messages go out). A dropped socket reconnects with capped exponential backoff and jitter, until `close()` or
 * until the room says it is `closed`. A message of a channel or kind this build does not know is ignored.
 */
import {
  ROOM_ID_PATTERN,
  ROOM_PROTOCOL_VERSION,
  ROOM_TOKEN_PATTERN,
  TABLE_ID_PATTERN,
  type ClientMessage,
  type RoomCapability,
  type RoomCreated,
  type RoomError,
  type ServerMessage,
} from "@mc/sync-worker/room-protocol";

export const ROOM_CALL_TIMEOUT_MS = 20_000;
export const RECONNECT_BASE_MS = 1_000;
export const RECONNECT_CAP_MS = 30_000;

/** The slice of a browser `WebSocket` this uses. */
export interface WebSocketLike {
  readonly readyState: number;
  onopen: ((event: unknown) => void) | null;
  onmessage: ((event: { readonly data: unknown }) => void) | null;
  onclose: ((event: unknown) => void) | null;
  onerror: ((event: unknown) => void) | null;
  send(data: string): void;
  close(code?: number, reason?: string): void;
}

export type WebSocketConstructor = new (url: string) => WebSocketLike;

const OPEN = 1;
/** The room closes a host's old socket with this code when the same host reconnects elsewhere. */
export const REPLACED_CLOSE_CODE = 4000;

export interface RoomSocketDeps {
  readonly WebSocket: WebSocketConstructor;
  readonly setTimer: (run: () => void, ms: number) => unknown;
  readonly clearTimer: (handle: unknown) => void;
  readonly random: () => number;
}

export const defaultSocketDeps = (): RoomSocketDeps => ({
  WebSocket: globalThis.WebSocket as unknown as WebSocketConstructor,
  setTimer: (run, ms) => setTimeout(run, ms),
  clearTimer: (handle) => clearTimeout(handle as ReturnType<typeof setTimeout>),
  random: () => Math.random(),
});

/** `https://host` becomes `wss://host/room/<id>/ws` (and `http` becomes `ws`, for `wrangler dev`). */
export function roomSocketUrl(baseUrl: string, roomId: string): string {
  return `${baseUrl.replace(/\/+$/, "").replace(/^http/, "ws")}/room/${roomId}/ws`;
}

/** The delay before reconnect attempt number `attempt` (0 for the first): doubling, capped, with 50-100% jitter. */
export function reconnectDelay(attempt: number, random: () => number): number {
  const raw = Math.min(RECONNECT_CAP_MS, RECONNECT_BASE_MS * 2 ** Math.min(attempt, 20));
  return Math.round(raw * (0.5 + 0.5 * random()));
}

const KINDS: Readonly<Record<string, ReadonlySet<string>>> = {
  room: new Set(["welcome", "roster", "table", "closed", "refused"]),
  game: new Set(["resend", "log", "commands", "rewind", "end", "proposal"]),
  chat: new Set(["said"]),
};

/** A server message this build understands, or null (bad JSON, another version, an unknown channel or kind). */
export function parseServerMessage(data: unknown): ServerMessage | null {
  if (typeof data !== "string") return null;
  let value: unknown;
  try {
    value = JSON.parse(data);
  } catch {
    return null;
  }
  if (typeof value !== "object" || value === null || Array.isArray(value)) return null;
  const m = value as Record<string, unknown>;
  if (m.v !== ROOM_PROTOCOL_VERSION || typeof m.ch !== "string" || typeof m.kind !== "string") return null;
  if (!KINDS[m.ch]?.has(m.kind)) return null;
  return m as unknown as ServerMessage;
}

export interface RoomSocketOptions {
  readonly baseUrl: string;
  readonly roomId: string;
  /** The host token (or, later, a seat's); absent joins as a watcher. */
  readonly token?: string;
  readonly caps?: readonly RoomCapability[];
  /** The `welcome` arrived (true: game messages may go out) or the socket dropped (false). */
  readonly onConnection: (connected: boolean) => void;
  readonly onMessage: (message: ServerMessage) => void;
  /** The room said it is closing: no reconnect follows. */
  readonly onClosed?: (reason: "ended" | "idle" | "disabled") => void;
  /** Another socket took this one's place as the host (close code 4000 "replaced"): no reconnect follows. */
  readonly onReplaced?: () => void;
  readonly deps?: RoomSocketDeps;
}

export class RoomSocket {
  readonly #options: RoomSocketOptions;
  readonly #deps: RoomSocketDeps;
  #socket: WebSocketLike | null = null;
  #timer: unknown = null;
  #attempt = 0;
  #welcomed = false;
  #stopped = false;

  constructor(options: RoomSocketOptions) {
    this.#options = options;
    this.#deps = options.deps ?? defaultSocketDeps();
  }

  get connected(): boolean {
    return this.#welcomed;
  }

  connect(): void {
    if (this.#stopped || this.#socket) return;
    let socket: WebSocketLike;
    try {
      socket = new this.#deps.WebSocket(roomSocketUrl(this.#options.baseUrl, this.#options.roomId));
    } catch {
      this.#scheduleReconnect();
      return;
    }
    this.#socket = socket;
    socket.onopen = () => {
      const hello: ClientMessage = {
        v: ROOM_PROTOCOL_VERSION,
        ch: "room",
        kind: "hello",
        ...(this.#options.token ? { token: this.#options.token } : {}),
        caps: this.#options.caps ?? ["watch"],
      };
      socket.send(JSON.stringify(hello));
    };
    socket.onmessage = (event) => {
      const message = parseServerMessage(event.data);
      if (!message) return;
      if (message.ch === "room" && message.kind === "welcome") {
        this.#attempt = 0;
        this.#welcomed = true;
        this.#options.onConnection(true);
      }
      if (message.ch === "room" && message.kind === "closed") {
        this.#stopped = true;
        this.#options.onClosed?.(message.reason);
      }
      this.#options.onMessage(message);
    };
    const dropped = (event?: unknown): void => {
      if (this.#socket !== socket) return;
      const replaced = (event as { code?: number } | undefined)?.code === REPLACED_CLOSE_CODE;
      if (replaced) this.#stopped = true;
      this.#socket = null;
      if (this.#welcomed) {
        this.#welcomed = false;
        this.#options.onConnection(false);
      }
      if (replaced) this.#options.onReplaced?.();
      else this.#scheduleReconnect();
    };
    socket.onclose = dropped;
    socket.onerror = () => {
      // An error is always followed by a close; closing here makes sure of it.
      try {
        socket.close();
      } catch {
        // already closed
      }
      dropped();
    };
  }

  /** Sends a message; false when the socket is not welcomed (nothing was sent). */
  send(message: ClientMessage): boolean {
    const socket = this.#socket;
    if (!socket || !this.#welcomed || socket.readyState !== OPEN) return false;
    try {
      socket.send(JSON.stringify(message));
      return true;
    } catch {
      return false;
    }
  }

  close(): void {
    this.#stopped = true;
    if (this.#timer !== null) this.#deps.clearTimer(this.#timer);
    this.#timer = null;
    const socket = this.#socket;
    this.#socket = null;
    const was = this.#welcomed;
    this.#welcomed = false;
    if (socket) {
      socket.onopen = socket.onmessage = socket.onclose = socket.onerror = null;
      try {
        socket.close(1000);
      } catch {
        // already closed
      }
    }
    if (was) this.#options.onConnection(false);
  }

  #scheduleReconnect(): void {
    if (this.#stopped || this.#timer !== null) return;
    const delay = reconnectDelay(this.#attempt++, this.#deps.random);
    this.#timer = this.#deps.setTimer(() => {
      this.#timer = null;
      this.connect();
    }, delay);
  }
}

// ---------------------------------------------------------------------------------------------------------------

export type CreateRoomFailure = "unavailable" | "rate-limited" | "disabled";

export type CreateRoomResult =
  | { readonly ok: true; readonly room: RoomCreated }
  | { readonly ok: false; readonly failure: CreateRoomFailure };

export interface CreateRoomDeps {
  readonly baseUrl: string | null;
  readonly fetch: typeof fetch;
}

/** `POST /room`: makes a room and answers its id, host token and first table. */
export async function createRoom(deps: CreateRoomDeps): Promise<CreateRoomResult> {
  if (!deps.baseUrl) return { ok: false, failure: "unavailable" };
  let response: Response;
  try {
    response = await deps.fetch(`${deps.baseUrl}/room`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{}",
      signal: AbortSignal.timeout(ROOM_CALL_TIMEOUT_MS),
    });
  } catch {
    return { ok: false, failure: "unavailable" };
  }
  if (!response.ok) {
    let reason: RoomError["reason"] | null = null;
    try {
      const body = (await response.json()) as Partial<RoomError>;
      reason = typeof body.reason === "string" ? body.reason : null;
    } catch {
      reason = null;
    }
    if (response.status === 429 || reason === "rate-limited") return { ok: false, failure: "rate-limited" };
    if (reason === "disabled") return { ok: false, failure: "disabled" };
    return { ok: false, failure: "unavailable" };
  }
  try {
    const room = (await response.json()) as RoomCreated;
    const valid =
      ROOM_ID_PATTERN.test(room.roomId) && ROOM_TOKEN_PATTERN.test(room.hostToken) && TABLE_ID_PATTERN.test(room.table);
    return valid ? { ok: true, room } : { ok: false, failure: "unavailable" };
  } catch {
    return { ok: false, failure: "unavailable" };
  }
}
