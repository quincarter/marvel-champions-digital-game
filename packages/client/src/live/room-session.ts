/**
 * One room connection for this device (issue #880, docs/live-game-rooms.md section 8): the socket, the lobby model, the
 * seat tokens and, by role, either the host's game stream or the guest's feed to its watcher. The live-room worker's
 * controller owns at most one. Plain logic with the socket, timers, storage and `fetch` injected, so it is tested with
 * fakes.
 *
 * - **Host**: makes a lobby room (`POST /room { lobby: true }`), connects with the host token, name and build. Its
 *   game's publisher attaches to the same socket (`attachGame`), so the room's lobby and its log share one host
 *   connection; nothing here knows what a game is.
 * - **Guest**: resolves a code (`GET /room/code/:code`) or takes a room id, connects with name, build and the stored
 *   seat tokens, and keeps a `GameMirror` of the room's game; `follow(port)` hands that game to the watcher.
 * - **Seat tokens** are bearer secrets: kept here and in the store, never put into `RoomState` or logged.
 */
import {
  FIRST_TABLE,
  ROOM_PROTOCOL_VERSION,
  type ClientMessage,
  type RoomBuild,
  type ServerMessage,
  type TableInfo,
} from "@mc/sync-worker/room-protocol";
import {
  createRoom as defaultCreateRoom,
  defaultSocketDeps,
  parseJoinTarget,
  reconnectDelay,
  RECONNECT_CAP_MS,
  resolveRoomCode as defaultResolveRoomCode,
  RoomSocket,
  type CreateRoomDeps,
  type CreateRoomResult,
  type ResolveCodeResult,
  type RoomSocketDeps,
} from "./room-socket.js";
import { GameMirror } from "./room-game-mirror.js";
import { RoomModel } from "./room-model.js";
import { seatTokensFresh, type SeatTokenStore } from "./room-seat-store.js";
import type { LobbySeatSpec, LobbySettingsPatch, RoomProblem, RoomState } from "./room-state.js";
import type { RoomFeedIn, RoomFeedOut } from "./live-room-protocol.js";

type DistributiveOmit<T, K extends PropertyKey> = T extends unknown ? Omit<T, K> : never;
type Body = DistributiveOmit<ClientMessage, "v">;

/** What a host's game publisher needs from the room connection (see `LiveRoomController`). */
export interface GameHooks {
  /** The socket was welcomed (again): `table` is what the room holds of the first table. */
  readonly onWelcome: (table: Pick<TableInfo, "commands" | "ended" | "hasHeader"> | undefined) => void;
  readonly onDisconnected: () => void;
  /** Every room message, for `resend` and refusals of the log. */
  readonly onMessage: (message: ServerMessage) => void;
  /** The room is over for this device (closed, replaced, gone): stop streaming. */
  readonly onEnded: () => void;
}

/** The slice of a `MessagePort` a feed uses. */
export interface FeedPort {
  onmessage: ((event: { readonly data: unknown }) => void) | null;
  postMessage(message: RoomFeedOut): void;
  start?(): void;
  close(): void;
}

export interface RoomSessionDeps {
  readonly syncUrl: string | null;
  /** The web version's address the join link hangs off. */
  readonly linkBase: string;
  readonly build: RoomBuild;
  readonly device?: RoomDevice;
  readonly seatStore: SeatTokenStore;
  readonly onState: (state: RoomState) => void;
  readonly now?: () => number;
  readonly fetch?: typeof fetch;
  readonly createRoom?: (deps: CreateRoomDeps) => Promise<CreateRoomResult>;
  readonly resolveRoomCode?: (deps: CreateRoomDeps, code: string) => Promise<ResolveCodeResult>;
  readonly socket?: RoomSocketDeps;
}

const CAPS = ["watch", "chat", "seats"] as const;

const FEED_ROOM_KINDS: ReadonlySet<string> = new Set(["welcome", "roster", "table", "closed"]);
const SEAT_REFUSED_TO_CLOSE = new Set(["name-required", "full"]);

export class RoomSession {
  readonly role: "host" | "guest";
  readonly #deps: RoomSessionDeps;
  readonly #timers: RoomSocketDeps;
  readonly #model: RoomModel;
  readonly #name: string;
  #socket: RoomSocket | null = null;
  #hostToken: string | null = null;
  #tokens: Record<string, string> = {};
  #hooks: GameHooks | null = null;
  readonly #mirror = new GameMirror();
  #feed: FeedPort | null = null;
  #closed = false;
  /** Resolves when the room is made (or failed): a game that starts meanwhile waits for it. */
  #ready: Promise<void> = Promise.resolve();
  /** Gap reconnects in a row (backoff), and the timer of the one pending. */
  #gapAttempt = 0;
  #gapTimer: unknown = null;
  #lastGapAt = Number.NEGATIVE_INFINITY;
  /** Bumped by each `start`/`close`, so a lookup that returns after the session was left does nothing. */
  #generation = 0;

  constructor(role: "host" | "guest", name: string, deps: RoomSessionDeps) {
    this.role = role;
    this.#name = name;
    this.#deps = deps;
    this.#timers = deps.socket ?? defaultSocketDeps();
    this.#model = new RoomModel({ role, name, build: deps.build, linkBase: deps.linkBase });
    // Records of rooms never come back to would pile up: drop the ones past the room's own idle limit.
    void deps.seatStore.sweep?.((deps.now ?? Date.now)()).catch(() => {});
  }

  state(): RoomState {
    return this.#model.state();
  }

  get roomId(): string | null {
    return this.#model.roomId;
  }

  get code(): string | null {
    return this.#model.code;
  }

  get name(): string {
    return this.#name;
  }

  /** The host token, for the live record a resumed game finds again. Stays in the worker. */
  get hostToken(): string | null {
    return this.#hostToken;
  }

  get connected(): boolean {
    return this.#socket?.connected ?? false;
  }

  /** What the room holds of the first table, as the last welcome or `table` message said. */
  get table(): TableInfo | null {
    return this.#model.table;
  }

  get ended(): boolean {
    return this.#closed || this.state().connection === "ended";
  }

  /** Nothing to connect to: the room never came up for this reason (no online name, say). */
  failWith(problem: RoomProblem): void {
    this.#generation++;
    this.#fail(problem);
  }

  // -- starting ---------------------------------------------------------------------------------------------------

  /** Host: makes the lobby room and connects to it. */
  startHost(): Promise<void> {
    this.#ready = this.#startHost();
    return this.#ready;
  }

  /** Settles once the lobby room exists (or could not be made). */
  get ready(): Promise<void> {
    return this.#ready;
  }

  async #startHost(): Promise<void> {
    const generation = ++this.#generation;
    this.#publish();
    const baseUrl = this.#deps.syncUrl;
    if (!baseUrl) return this.#fail("no-service");
    const create = this.#deps.createRoom ?? defaultCreateRoom;
    const result = await create({ baseUrl, fetch: this.#fetch(), lobby: true });
    if (generation !== this.#generation) return;
    if (!result.ok) {
      return this.#fail(
        result.failure === "rate-limited" ? "rate-limited" : result.failure === "disabled" ? "disabled" : "unavailable",
      );
    }
    this.#hostToken = result.room.hostToken;
    this.#model.setRoom(result.room.roomId, result.room.code);
    this.#connect(result.room.roomId);
  }

  /** Host: goes back to a room it made earlier (a resumed game after a reload). */
  resumeHost(roomId: string, hostToken: string, code?: string): void {
    this.#generation++;
    this.#hostToken = hostToken;
    this.#model.setRoom(roomId, code);
    this.#publish();
    this.#connect(roomId);
  }

  /** Guest: `target` is a room code (looked up) or a room id (a link's own). */
  async startGuest(target: string): Promise<void> {
    const generation = ++this.#generation;
    this.#publish();
    const baseUrl = this.#deps.syncUrl;
    if (!baseUrl) return this.#fail("no-service");
    const parsed = parseJoinTarget(target);
    if (!parsed) return this.#fail("not-found");
    let roomId: string;
    if ("roomId" in parsed) roomId = parsed.roomId;
    else {
      const resolve = this.#deps.resolveRoomCode ?? defaultResolveRoomCode;
      const result = await resolve({ baseUrl, fetch: this.#fetch() }, parsed.code);
      if (generation !== this.#generation) return;
      if (!result.ok) return this.#fail(result.failure === "unavailable" ? "unavailable" : result.failure);
      roomId = result.roomId;
    }
    this.#model.setRoom(roomId, "roomId" in parsed ? undefined : parsed.code);
    await this.#loadTokens(roomId);
    if (generation !== this.#generation) return;
    this.#connect(roomId);
  }

  /** Leaves the room: the socket closes, the seat tokens stay (joining again restores the seats). */
  close(): void {
    this.#generation++;
    this.#closed = true;
    this.#clearGapTimer();
    this.#socket?.close();
    this.#socket = null;
    this.#hooks = null;
    this.unfollow();
    this.#mirror.clear();
    this.#model.ended(this.#model.state().problem ?? "closed-ended");
  }

  // -- the game ---------------------------------------------------------------------------------------------------

  /** Host: the game's publisher uses this socket. Welcomes it at once when the socket is already up. */
  attachGame(hooks: GameHooks): void {
    this.#hooks = hooks;
    this.#model.setHostStarted(true);
    this.#publish();
    if (this.#socket?.connected) hooks.onWelcome(this.#tableInfo());
  }

  detachGame(): void {
    this.#hooks = null;
    this.#model.setHostStarted(false);
    this.#publish();
  }

  /** Sends one message on the room's socket; false when it is not up. */
  send(message: ClientMessage): boolean {
    return this.#socket?.send(message) ?? false;
  }

  // -- the lobby --------------------------------------------------------------------------------------------------

  lobbySet(change: { readonly settings?: LobbySettingsPatch; readonly seats?: readonly LobbySeatSpec[] }): void {
    if (this.role !== "host" || (!change.settings && !change.seats)) return;
    this.#say({
      ch: "room",
      kind: "lobby-set",
      ...(change.settings ? { settings: change.settings } : {}),
      ...(change.seats ? { seats: change.seats } : {}),
    });
  }

  seat(op: "request" | "release" | "assign" | "deny", seat: string, participant?: string): void {
    if (op === "request") {
      this.#model.noteRequest(seat);
      this.#model.want(seat, true);
      this.#say({ ch: "room", kind: "seat-request", seat });
    } else if (op === "release") {
      this.#model.want(seat, false);
      this.#say({ ch: "room", kind: "seat-release", seat });
    } else if (this.role === "host" && participant) {
      if (op === "assign") this.#model.noteRequest(seat);
      this.#say({ ch: "room", kind: op === "assign" ? "seat-assign" : "seat-deny", seat, participant });
    }
  }

  chat(text: string): void {
    if (text.trim().length === 0) return;
    this.#say({ ch: "chat", kind: "say", text });
  }

  // -- a guest's feed ---------------------------------------------------------------------------------------------

  /** Guest: the watcher takes the room's game over `port`: first what has arrived, then everything as it comes. */
  follow(port: FeedPort): void {
    this.unfollow();
    this.#feed = port;
    port.onmessage = (event) => {
      if ((event.data as RoomFeedIn | undefined)?.kind === "resync") this.#sendSnapshot();
    };
    port.start?.();
    this.#sendSnapshot();
    if (this.#socket && !this.#socket.connected) port.postMessage({ kind: "connection", connected: false });
  }

  unfollow(): void {
    const port = this.#feed;
    this.#feed = null;
    if (!port) return;
    port.onmessage = null;
    port.postMessage({ kind: "gone" });
    try {
      port.close();
    } catch {
      // already closed
    }
  }

  // -- internals --------------------------------------------------------------------------------------------------

  #fetch(): typeof fetch {
    return this.#deps.fetch ?? ((...args) => globalThis.fetch(...args));
  }

  #tableInfo(): Pick<TableInfo, "commands" | "ended" | "hasHeader"> | undefined {
    const t = this.#model.table;
    return t ? { commands: t.commands, ended: t.ended, hasHeader: t.hasHeader } : undefined;
  }

  #publish(): void {
    this.#deps.onState(this.#model.state());
  }

  #fail(problem: RoomProblem): void {
    this.#model.ended(problem);
    this.#publish();
  }

  #say(body: Body): void {
    this.#socket?.send({ v: ROOM_PROTOCOL_VERSION, ...body } as ClientMessage);
  }

  async #loadTokens(roomId: string): Promise<void> {
    try {
      const record = await this.#deps.seatStore.load(roomId);
      if (!record) return;
      if (seatTokensFresh(record, (this.#deps.now ?? Date.now)())) this.#tokens = { ...record.tokens };
      else void this.#deps.seatStore.clear(roomId).catch(() => {});
    } catch {
      // No stored seats: the player asks again.
    }
  }

  #saveTokens(): void {
    const roomId = this.#model.roomId;
    if (!roomId) return;
    const store = this.#deps.seatStore;
    if (Object.keys(this.#tokens).length === 0) void store.clear(roomId).catch(() => {});
    else {
      void store.save({ roomId, tokens: { ...this.#tokens }, savedAt: (this.#deps.now ?? Date.now)() }).catch(() => {});
    }
  }

  #connect(roomId: string): void {
    const baseUrl = this.#deps.syncUrl;
    if (!baseUrl || this.#closed) return;
    const socket: RoomSocket = new RoomSocket({
      baseUrl,
      roomId,
      ...(this.#hostToken ? { token: this.#hostToken } : {}),
      caps: CAPS,
      name: this.#name,
      build: this.#deps.build,
      ...(this.#deps.device ? { device: this.#deps.device } : {}),
      seatTokens: () => Object.values(this.#tokens),
      deps: this.#timers,
      onConnection: (connected) => {
        if (this.#socket !== socket || connected) return;
        this.#model.dropped();
        this.#hooks?.onDisconnected();
        this.#feed?.postMessage({ kind: "connection", connected: false });
        this.#publish();
      },
      onMessage: (message) => {
        if (this.#socket === socket) this.#onMessage(message);
      },
      onReplaced: () => this.#over("replaced"),
      onGone: () => this.#over(this.role === "host" ? "gone" : "not-found"),
    });
    this.#socket = socket;
    this.#publish();
    socket.connect();
  }

  /** Nothing more will come from the room: say why, stop the socket and the game's stream. */
  #over(problem: RoomProblem): void {
    this.#model.ended(problem);
    this.#socket?.close();
    this.#socket = null;
    const hooks = this.#hooks;
    this.#hooks = null;
    this.#clearGapTimer();
    // A closed room already reached the watcher as a `closed` message; any other end tells it to stop following.
    this.#feed?.postMessage(
      problem.startsWith("closed-") ? { kind: "connection", connected: false } : { kind: "gone" },
    );
    this.#publish();
    hooks?.onEnded();
  }

  #onMessage(message: ServerMessage): void {
    if (message.ch === "room" && message.kind === "welcome" && this.role === "host" && message.you.role !== "host") {
      // A token the room no longer honours silently joins as a watcher: this room is not ours to stream into.
      this.#over("gone");
      return;
    }
    if (message.ch === "room" && message.kind === "seat-token") {
      // Private to this device: kept and presented on the next hello, never shown.
      this.#tokens[message.seat] = message.token;
      this.#saveTokens();
      return;
    }
    if (message.ch === "room" && message.kind === "refused" && SEAT_REFUSED_TO_CLOSE.has(message.reason)) {
      this.#model.onMessage(message);
      this.#over(message.reason === "full" ? "full" : "no-name");
      return;
    }
    const changed = this.#model.onMessage(message);
    if (message.ch === "room" && message.kind === "lobby") {
      this.#pruneTokens();
      // A request the lobby no longer lists (the room woke from hibernation and forgot it; the socket survives that, so
      // there is no welcome) is sent again. A denied one was told to us (`seat-denied`) and is no longer wanted.
      for (const seat of this.#model.lostRequests()) this.#say({ ch: "room", kind: "seat-request", seat });
    }
    if (this.role === "guest") this.#guestMessage(message);
    else if (message.ch === "room" && message.kind === "welcome") this.#hooks?.onWelcome(this.#tableInfo());
    this.#hooks?.onMessage(message);
    if (message.ch === "room" && message.kind === "closed") {
      this.#over(this.#model.state().problem ?? "closed-ended");
      return;
    }
    if (changed) this.#publish();
  }

  /** A token whose seat I do not hold any more (released, taken back, never honoured) is dropped. */
  #pruneTokens(): void {
    const lobby = this.#model.lobby;
    const me = this.#model.meId;
    if (!lobby || !me) return;
    let dropped = false;
    for (const seat of Object.keys(this.#tokens)) {
      const held = lobby.seats.some((s) => s.id === seat && s.holder === me);
      if (!held) {
        delete this.#tokens[seat];
        dropped = true;
      }
    }
    if (dropped) this.#saveTokens();
  }

  #guestMessage(message: ServerMessage): void {
    if (message.ch === "room" && message.kind === "welcome") {
      // A reconnect: the room sends the whole log again, which resets the mirror.
      this.#feed?.postMessage({ kind: "connection", connected: true });
    }
    if (message.ch === "game" && "table" in message && message.table === FIRST_TABLE) {
      const result = this.#mirror.apply(message);
      if (result === "gap") {
        // Not a log this side can follow: the room sends a fresh one on the next connection.
        this.#reconnect();
        return;
      }
    }
    // The watcher follows the game and who is in the room; chat, the lobby and tokens are the lobby's own.
    if (message.ch === "game" || (message.ch === "room" && FEED_ROOM_KINDS.has(message.kind))) {
      this.#feed?.postMessage({ kind: "server", message });
    }
  }

  /**
   * Drops the socket and connects again after a backoff (a new hello): the room answers with the whole log. Repeated
   * gaps wait longer each time (the socket's own schedule, capped), so a room that keeps sending bad batches is not hammered.
   */
  #reconnect(): void {
    const roomId = this.#model.roomId;
    this.#socket?.close();
    this.#socket = null;
    this.#mirror.clear();
    this.#model.dropped();
    this.#publish();
    this.#feed?.postMessage({ kind: "connection", connected: false });
    if (!roomId || this.#closed || this.#gapTimer !== null) return;
    // A gap long after the last one starts the schedule again; gaps close together climb it.
    const now = (this.#deps.now ?? Date.now)();
    if (now - this.#lastGapAt > RECONNECT_CAP_MS) this.#gapAttempt = 0;
    this.#lastGapAt = now;
    this.#gapTimer = this.#timers.setTimer(
      () => {
        this.#gapTimer = null;
        if (!this.#closed && !this.#socket) this.#connect(roomId);
      },
      reconnectDelay(this.#gapAttempt++, this.#timers.random),
    );
  }

  #clearGapTimer(): void {
    if (this.#gapTimer === null) return;
    this.#timers.clearTimer(this.#gapTimer);
    this.#gapTimer = null;
  }

  #sendSnapshot(): void {
    const feed = this.#feed;
    if (!feed) return;
    // What a joiner's `welcome` tells it: who is here (the watchers count), whether the host is, and whether the game started.
    const welcome = this.#model.welcomeFor();
    if (welcome) feed.postMessage({ kind: "server", message: welcome });
    for (const message of this.#mirror.snapshot()) feed.postMessage({ kind: "server", message });
  }
}
