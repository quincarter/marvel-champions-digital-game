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
  type DeckRefusalCode,
  type HostActivityStep,
  type VillainCursorState,
  type TablePlan,
  type RoomDeck,
  type RoomBuild,
  type RoomDevice,
  type ProposalRefusal,
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
import { GameMirror, type RoomGameSalvage } from "./room-game-mirror.js";
import { RoomModel } from "./room-model.js";
import { seatFeedMessage } from "./seat-protocol.js";
import { seatTokensFresh, type SeatTokenStore } from "./room-seat-store.js";
import type { LobbySeatSpec, LobbySettingsPatch, RoomProblem, RoomState, SeatDeckEntry } from "./room-state.js";
import type { RoomFeedIn, RoomFeedOut } from "./live-room-protocol.js";
import { askAllowedOf } from "../view/room-ask-policy.js";

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
  readonly onEnded: (problem: RoomProblem) => void;
  /**
   * A seat holder's proposal, with the engine players behind the seats it may act for (issue #881). Absent: the session
   * answers `stale` itself.
   */
  readonly onProposal?: (proposal: {
    readonly from: string;
    readonly players: readonly string[];
    readonly command: unknown;
    readonly base: number;
    readonly pid?: number;
    readonly stamp?: string;
  }) => void;
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
  /**
   * A guest's room was closed under it with a game still being played: the game as this guest holds it, handed over
   * ahead of the end state so the device can keep it (`live/room-continue.ts`). Absent: nothing is kept.
   */
  readonly onSalvage?: (game: RoomGameSalvage) => void;
}

const CAPS = ["watch", "chat", "seats"] as const;
/** A host also judges seat holders' proposals (issue #881). */
const HOST_CAPS = ["watch", "chat", "seats", "play"] as const;

/** How long the host waits for the room to hand over the decks before Start gives up. */
export const DECKS_REPLY_MS = 8000;

const FEED_ROOM_KINDS: ReadonlySet<string> = new Set(["welcome", "roster", "table", "closed", "refused"]);
/** Acceptances held for a dropped socket: a host answers a few proposals at a time, so this is never reached in play. */
const MAX_UNSENT_ACCEPTS = 50;
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
  readonly #unsentAccepts: Body[] = [];
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
  /** Host: callers waiting for the room's `seat-decks` answer. */
  readonly #deckWaiters: { done: (decks: readonly SeatDeckEntry[] | null) => void; timer: unknown }[] = [];

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
    const generation = ++this.#generation;
    this.#hostToken = hostToken;
    this.#model.setRoom(roomId, code);
    this.#publish();
    // The host's own seat tokens go on the hello, or the room still holds its seat for the old connection.
    void this.#loadTokens(roomId).then(() => {
      if (generation === this.#generation) this.#connect(roomId);
    });
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

  /**
   * Leaves the room: the socket closes, the seat tokens stay (joining again restores the seats). A host with
   * `closeRoom` first asks the room to close for everyone (guests are told, the code is released, the room is gone).
   */
  close(options: { readonly closeRoom?: boolean } = {}): void {
    if (options.closeRoom && this.role === "host" && !this.#closed) this.#say({ ch: "room", kind: "room-close" });
    this.#generation++;
    this.#closed = true;
    this.#clearGapTimer();
    this.#socket?.close();
    this.#socket = null;
    this.#hooks = null;
    this.unfollow();
    this.#mirror.clear();
    this.#answerDecks(null);
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

  lobbySet(change: {
    readonly settings?: LobbySettingsPatch;
    readonly seats?: readonly LobbySeatSpec[];
    readonly ifRev?: number;
  }): void {
    // Once the table has its game the seats are fixed, and so is who plays which hero (`player`): a seat list changed
    // under a running game would repoint proposals at other heroes. Settings stay the host's to change.
    const frozen = this.#model.state().started && !this.#model.state().gameOver;
    const seats = frozen ? undefined : change.seats;
    if (this.role !== "host" || (!change.settings && !seats)) return;
    this.#say({
      ch: "room",
      kind: "lobby-set",
      ...(change.settings ? { settings: change.settings } : {}),
      ...(change.ifRev !== undefined ? { ifRev: change.ifRev } : {}),
      // The room drops a seat's `player` unless every `lobby-set` repeats it: seat n plays engine player p<n> (the order
      // setup built the game's players in), so a spec without one gets it from its position.
      ...(seats ? { seats: seats.map((spec, index) => ({ ...spec, player: spec.player ?? `p${index + 1}` })) } : {}),
    });
  }

  seat(
    op: "request" | "release" | "assign" | "deny" | "take-over" | "give-back",
    seat: string,
    participant?: string,
  ): void {
    if (op === "take-over" || op === "give-back") {
      if (this.role === "host") this.#say({ ch: "room", kind: op, seat });
      return;
    }
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

  /** Shows or hides a seat's hand to the table; the room refuses a seat this device may not set. */
  showHand(seat: string, on: boolean): void {
    this.#say({ ch: "room", kind: "seat-show-hand", seat, on });
  }

  /**
   * Host: answers a seat holder's request (`RoomState.requests`); the caller has already done what an accepted one asks.
   * A request already gone (answered, or its asker left) is ignored.
   */
  answerRequest(id: string, accepted: boolean): void {
    if (this.role !== "host") return;
    const request = this.#model.takeRequest(id);
    if (!request) return;
    this.#say({
      ch: "game",
      kind: "request-answer",
      table: FIRST_TABLE,
      to: request.from,
      accepted,
      ...(request.rid === undefined ? {} : { rid: request.rid }),
    });
    this.#publish();
  }

  /** Guest: asks the host to undo or change something (Host control rooms; the room refuses it in a Strict one). */
  askHost(what: "undo" | "adjust", note: string): void {
    if (this.role !== "guest") return;
    const rid = this.#model.noteAsk(what);
    this.#say({ ch: "game", kind: "request", table: FIRST_TABLE, what, note: note.trim().slice(0, 140), rid });
    this.#publish();
  }

  /** Guest: dismisses the answer to my last request. */
  clearAsk(): void {
    this.#model.clearAsk();
    this.#publish();
  }

  /** Host: turns a proposal down (the engine worker's verdict); the room tells the proposer alone. */
  refuseProposal(to: string, reason: ProposalRefusal, base: number, pid?: number): void {
    if (this.role !== "host") return;
    this.#say({
      ch: "game",
      kind: "proposal-refused",
      table: FIRST_TABLE,
      to,
      reason,
      base,
      ...(pid === undefined ? {} : { pid }),
    });
  }

  /**
   * Host: the log was cut back to `to`. An acceptance still held for a dropped socket names a command at or past the cut,
   * which no longer exists: sent later it would credit whatever is played at that position next, so it is forgotten.
   */
  dropHeldAcceptances(to: number): void {
    for (let i = this.#unsentAccepts.length - 1; i >= 0; i--) {
      if ((this.#unsentAccepts[i] as { base: number }).base >= to) this.#unsentAccepts.splice(i, 1);
    }
  }

  /** Host: tells a proposer its proposal was applied (the engine worker's verdict); the room tells the proposer alone. */
  acceptProposal(to: string, base: number, pid?: number): void {
    if (this.role !== "host") return;
    const body: Body = {
      ch: "game",
      kind: "proposal-accepted",
      table: FIRST_TABLE,
      to,
      base,
      ...(pid === undefined ? {} : { pid }),
    };
    // A dropped socket loses it, and the proposer would then report a move that landed as unanswered: it is kept and
    // sent again on the next welcome, ahead of the publisher's catch-up of the log.
    if (!this.#trySay(body)) {
      this.#unsentAccepts.push(body);
      if (this.#unsentAccepts.length > MAX_UNSENT_ACCEPTS) this.#unsentAccepts.shift();
    }
  }

  /**
   * Sets the deck in a seat: a seat's holder sends their own, the host may send one for any seat (a preset the holder
   * can replace). Whatever the host said about the seat's old deck no longer applies. The room checks the size and
   * rate; its refusal shows as `state.refusal`.
   */
  chooseDeck(seat: string, deck: RoomDeck): void {
    this.#model.clearDeckProblem(seat);
    this.#say({ ch: "room", kind: "seat-deck", seat, deck });
    this.#publish();
  }

  /**
   * Host only: asks the room for every seat's full deck list and resolves with it, or null when the room did not answer
   * in time, the socket is down or this is not the host. A guest never gets another seat's list.
   */
  requestDecks(timeoutMs: number = DECKS_REPLY_MS): Promise<readonly SeatDeckEntry[] | null> {
    if (this.role !== "host" || !this.#socket?.connected) return Promise.resolve(null);
    return new Promise((resolve) => {
      const waiter = {
        done: (decks: readonly SeatDeckEntry[] | null) => {
          this.#timers.clearTimer(waiter.timer);
          const at = this.#deckWaiters.indexOf(waiter);
          if (at >= 0) this.#deckWaiters.splice(at, 1);
          resolve(decks);
        },
        timer: this.#timers.setTimer(() => waiter.done(null), timeoutMs),
      };
      this.#deckWaiters.push(waiter);
      this.#say({ ch: "room", kind: "seat-decks-request" });
    });
  }

  /** Host only: tells a seat's holder, and only them, why the host's engine refused their deck at Start. */
  refuseDeck(seat: string, code: DeckRefusalCode, reason: string): void {
    if (this.role !== "host") return;
    this.#say({ ch: "room", kind: "deck-refused", seat, code, reason });
  }

  /** Host only: which setup step I am in. Ephemeral: the room relays it, keeps it in memory and never stores it. */
  hostActivity(step: HostActivityStep, scenario?: string): void {
    if (this.role !== "host") return;
    this.#say({ ch: "room", kind: "host-activity", step, ...(scenario ? { scenario } : {}) });
  }

  /** Host only: where my villain phase screen is. Ephemeral: the room relays it to the guests, memory only, never stored. */
  villainCursor(key: string, at: number, state: VillainCursorState): void {
    if (this.role !== "host") return;
    this.#say({ ch: "room", kind: "villain-cursor", table: FIRST_TABLE, key, at, state });
  }

  /** Host only: the table the host picked (`null` clears it). Memory only in the room, never the lobby revision. */
  tablePlan(plan: TablePlan | null): void {
    if (this.role !== "host") return;
    this.#say({ ch: "room", kind: "table-plan", plan });
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
      else this.#sendSeatMessage(event.data);
    };
    port.start?.();
    this.#sendSnapshot();
    if (this.#socket && !this.#socket.connected) port.postMessage({ kind: "connection", connected: false });
  }

  /** A seated guest's proposal over the feed (`live/seat-protocol.ts`): sent to the room for the table's host to judge. */
  #sendSeatMessage(data: unknown): void {
    const message = seatFeedMessage(data);
    if (message) this.#say(message);
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
    this.#trySay(body);
  }

  #trySay(body: Body): boolean {
    return this.#socket?.send({ v: ROOM_PROTOCOL_VERSION, ...body } as ClientMessage) ?? false;
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
      caps: this.role === "host" ? HOST_CAPS : CAPS,
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
    // A guest whose room was closed (not one that was replaced or is gone) keeps the game it holds: the log is complete.
    if (this.role === "guest" && problem.startsWith("closed-") && !this.#closed) {
      const game = this.#mirror.salvage();
      if (game) this.#deps.onSalvage?.(game);
    }
    this.#model.ended(problem);
    this.#answerDecks(null);
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
    hooks?.onEnded(problem);
  }

  /** A seat holder's proposal: the engine worker judges it, with the players behind the seats the room named. */
  #onProposal(message: Extract<ServerMessage, { kind: "proposal" }>): void {
    const onProposal = this.#hooks?.onProposal;
    if (!onProposal) {
      // No game attached to judge it (a reload, or the stream ended): the proposer keeps following the log.
      this.refuseProposal(message.from, "stale", message.base, message.pid);
      return;
    }
    onProposal({
      from: message.from,
      players: this.#model.playersOfSeats(message.seats),
      command: message.command,
      base: message.base,
      ...(message.pid === undefined ? {} : { pid: message.pid }),
      ...(message.stamp === undefined ? {} : { stamp: message.stamp }),
    });
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
    if (message.ch === "room" && message.kind === "seat-decks") {
      // The full lists are for the host's Start only: handed to the waiting caller, never kept in the state.
      if (this.role === "host") this.#answerDecks(message.decks);
      return;
    }
    if (message.ch === "room" && message.kind === "refused" && SEAT_REFUSED_TO_CLOSE.has(message.reason)) {
      this.#model.onMessage(message);
      this.#over(message.reason === "full" ? "full" : "no-name");
      return;
    }
    if (this.role === "host" && message.ch === "game" && message.kind === "proposal") {
      this.#onProposal(message);
      return;
    }
    if (this.role === "host" && message.ch === "game" && message.kind === "request") {
      // The room refuses requests in a Strict room itself; one that slips through is declined, never listed.
      if (!askAllowedOf(message.what, this.#model.state().settings)) {
        this.#say({
          ch: "game",
          kind: "request-answer",
          table: FIRST_TABLE,
          to: message.from,
          accepted: false,
          ...(message.rid === undefined ? {} : { rid: message.rid }),
        });
        return;
      }
    }
    const changed = this.#model.onMessage(message);
    if (message.ch === "room" && message.kind === "lobby") {
      this.#pruneTokens();
      // A request the lobby no longer lists (the room woke from hibernation and forgot it; the socket survives that, so
      // there is no welcome) is sent again. A denied one was told to us (`seat-denied`) and is no longer wanted.
      for (const seat of this.#model.lostRequests()) this.#say({ ch: "room", kind: "seat-request", seat });
    }
    if (this.role === "guest") this.#guestMessage(message);
    else if (message.ch === "room" && message.kind === "welcome") {
      // Only what went out is dropped: a socket that fails mid-flush keeps that acceptance and the rest for the next one.
      let sent = 0;
      while (sent < this.#unsentAccepts.length && this.#trySay(this.#unsentAccepts[sent]!)) sent++;
      this.#unsentAccepts.splice(0, sent);
      this.#hooks?.onWelcome(this.#tableInfo());
    }
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
    const here = new Set(this.#model.state().participants.map((p) => p.id));
    for (const seat of Object.keys(this.#tokens)) {
      // A seat whose holder is someone not connected may still carry my token's hash (a rejoin the room could not
      // save), so only a free seat, a missing seat or one held by a connected other is a seat I have lost.
      // Keeping that token is on purpose (a not-saved rejoin): the room matches the hash, so a token that is not the
      // seat's current one is refused there, and a kept stale token costs nothing.
      const held = lobby.seats.some((s) => s.id === seat && (s.holder === me || (s.holder && !here.has(s.holder))));
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
    this.#mirror.clear(true);
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

  #answerDecks(decks: readonly SeatDeckEntry[] | null): void {
    for (const waiter of [...this.#deckWaiters]) waiter.done(decks);
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
