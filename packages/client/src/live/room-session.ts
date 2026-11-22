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
  type LobbyPod,
  type LobbyTableSpec,
  type DeckRefusalCode,
  type HostActivityStep,
  type RoomDeck,
  type RoomBuild,
  type RoomDevice,
  type ProposalRefusal,
  type ServerMessage,
  type TableInfo,
  type TeamId,
} from "@mc/sync-worker/room-protocol";
import { EpicCoordinator, type EpicCoordinatorOptions, type EpicLogStore } from "./epic-coordinator.js";
import { seatsAt, withEpicStart } from "./epic-start.js";
import type { PodCoordinatorGroupSetup } from "@mc/engine";
import { aliasTable } from "./table-alias.js";
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
  readonly onEnded: () => void;
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
  /** Where the organizer keeps the pod coordinator's log (Epic Multiplayer). Absent: the coordinator is not saved. */
  readonly epicStore?: EpicLogStore;
  readonly onState: (state: RoomState) => void;
  /** Competitive host: the room's `sealed` answer (both scenarios). Goes to this device's main thread, never into a state. */
  readonly onSealed?: (sealed: { readonly registration: unknown; readonly resistance: unknown }, rev: number) => void;
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

const CAPS = ["watch", "chat", "seats", "tables", "teams"] as const;
/** A host also judges seat holders' proposals (issue #881). */
const HOST_CAPS = ["watch", "chat", "seats", "play", "tables", "teams"] as const;
/** A table host token is kept beside the seat tokens under this prefix (a seat id never has a colon). */
const TABLE_KEY = "table:";

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
  /**
   * The game of every table this device receives, by table: a seat holder's own table, the tables it follows. Kept for
   * all of them, so a log that arrives before the lobby says which table is "mine" is not lost, and switching the
   * watched table (`watchTable`) shows what has already arrived.
   */
  readonly #mirrors = new Map<string, GameMirror>();
  /** A watcher's explicit choice of table (`watchTable`), for a device with no seat and no table of its own. */
  #watchOverride: string | null = null;
  /** After a (re)connect and until the lobby arrives, the lobby we hold is of the old connection: keep the view. */
  #awaitingLobby = false;
  /** Epic Multiplayer: the organizer's pod coordinator (made when the first table speaks) and its start. */
  #coordinator: EpicCoordinator | null = null;
  #coordinatorStart: Promise<EpicCoordinator | null> | null = null;
  /** The groups the coordinator was made from, so a lobby edited before the game starts makes a new one. */
  #coordinatorKey = "";
  /** The coordinator's game is over (every table ended): the next game in this room gets a new coordinator. */
  #coordinatorGameOver = false;
  /** The old game's saved log being cleared: a new coordinator restores only after it. */
  #coordinatorClear: (() => Promise<void>) | null = null;
  /** The last start failed on storage (a clear or a read): a retry is scheduled, with backoff, until one succeeds. */
  #coordinatorStartFailed = false;
  #coordinatorRetry: unknown = null;
  #coordinatorRetryAttempt = 0;
  /** Each table's latest sync heard while no coordinator existed, delivered once one does (its ack must still go out). */
  #epochToAnnounce = false;
  readonly #pendingSyncs = new Map<string, { readonly seq: number; readonly event: unknown }>();
  /** The tables this device asked to follow (`followTables`); null until it chooses, then the room is told. */
  #followChosen: "all" | readonly string[] | null = null;
  /** The follow last sent, so a lobby message does not repeat it. Cleared on a new connection. */
  #followSent = "";
  #feed: FeedPort | null = null;
  #feedId: number | undefined;
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
  /**
   * A sealed scenario submitted while the socket was down, sent again at the next welcome. Kept here and nowhere else:
   * never in the state, and dropped once it is sent (the room stores it).
   */
  #pendingScenario: { team: TeamId; scenario: unknown } | null = null;

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

  /** What the room holds of this device's table (the first, or its own in an Epic room), as the room last said. */
  get table(): TableInfo | null {
    return this.#model.table;
  }

  /**
   * This device runs a table's game: the room's host, or (Epic Multiplayer) a participant the organizer made a table
   * host. Its game streams into the room over this socket.
   */
  get hosting(): boolean {
    return this.role === "host" || this.#model.isHost;
  }

  /** The table this device hosts (the first in a standard room); null when it hosts none (an organizer with no table). */
  get hostedTable(): string | null {
    return this.#model.hostedTable ?? (this.role === "host" && !this.#epic() ? FIRST_TABLE : null);
  }

  /** A device that may stream a game: it holds the host token or a table host token. */
  get canHost(): boolean {
    return this.#hostToken !== null || Object.keys(this.#tokens).some((key) => key.startsWith(TABLE_KEY));
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
    this.#cancelCoordinatorRetry();
    this.#socket?.close();
    this.#socket = null;
    this.#hooks = null;
    this.#coordinator?.dispose();
    this.unfollow();
    for (const mirror of this.#mirrors.values()) mirror.clear();
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
      ...(seats ? { seats: this.#withPlayers(seats) } : {}),
    });
  }

  /** The seat list with each seat's player: its position in its table (the first table, or all one in a standard room). */
  #withPlayers(seats: readonly LobbySeatSpec[]): LobbySeatSpec[] {
    const counts = new Map<string, number>();
    return seats.map((spec) => {
      const table = spec.table ?? FIRST_TABLE;
      const index = counts.get(table) ?? 0;
      counts.set(table, index + 1);
      return { ...spec, player: spec.player ?? `p${index + 1}` };
    });
  }

  // -- Civil War Competitive (issue #883) ----------------------------------------------------------------------------

  /** Host: Competitive mode with these seats (each naming its team) and, optionally, the tie-break option. */
  setCompetitive(seats: readonly LobbySeatSpec[], tieBreaks?: boolean): void {
    if (this.role !== "host") return;
    this.#say({
      ch: "room",
      kind: "lobby-set",
      settings: { mode: "competitive", ...(tieBreaks === undefined ? {} : { tieBreaks }) },
      seats: this.#withPlayers(seats),
    });
  }

  /** Puts a seat on a team: the host's, or its holder's. The room refuses a third seat on a team or a player on both. */
  setTeam(seat: string, team: TeamId): void {
    this.#say({ ch: "room", kind: "team-set", seat, team });
  }

  /**
   * Seals the scenario `team` built for the other team in the room (the host's, or a holder of a seat on `team`'s).
   * It goes to the room and nowhere else: not into the state, not echoed. Sent again after a reconnect if the socket
   * was down.
   */
  submitScenario(team: TeamId, scenario: unknown): void {
    this.#pendingScenario = null;
    if (!this.#socket?.send({ v: ROOM_PROTOCOL_VERSION, ch: "room", kind: "scenario-submit", team, scenario })) {
      this.#pendingScenario = { team, scenario };
    }
  }

  setTeamReady(team: TeamId, ready: boolean): void {
    this.#say({ ch: "room", kind: "team-ready", team, ready });
  }

  /** Host: the tie-break option (default on). */
  setTieBreaks(on: boolean): void {
    if (this.role !== "host") return;
    this.#say({ ch: "room", kind: "lobby-set", settings: { tieBreaks: on } });
  }

  /** Host: asks the room for both teams' scenarios; the answer arrives as `deps.onSealed`. */
  revealSealed(): void {
    if (this.role !== "host") return;
    this.#say({ ch: "room", kind: "sealed-reveal" });
  }

  // -- Epic Multiplayer (issue #882) -----------------------------------------------------------------------------------

  #epic(): boolean {
    return this.#model.lobby?.settings.mode === "epic";
  }

  /** Organizer: Epic mode with these tables, pods and seats. Locked, like the seats, once a game is running. */
  setEpic(tables: readonly LobbyTableSpec[], pods: readonly LobbyPod[], seats: readonly LobbySeatSpec[]): void {
    if (this.role !== "host") return;
    this.#say({
      ch: "room",
      kind: "lobby-set",
      settings: { mode: "epic" },
      tables,
      pods,
      seats: this.#withPlayers(seats),
    });
  }

  /** Organizer: makes `participant` (or nobody) the host of `table`; the other tables keep their hosts. */
  assignTableHost(table: string, participant: string | null): void {
    const lobby = this.#model.lobby;
    if (this.role !== "host" || !lobby?.tables) return;
    this.#say({
      ch: "room",
      kind: "lobby-set",
      tables: lobby.tables.map((t) => ({
        id: t.id,
        name: t.name,
        pod: t.pod,
        ...(t.difficulty === undefined ? {} : { difficulty: t.difficulty }),
        ...(t.id === table ? { host: participant } : {}),
      })),
    });
  }

  /** Organizer: starts the game: every table host sees the start in the lobby and starts its own group. */
  startEpic(start: { readonly id: string; readonly seed: number; readonly at?: number }): void {
    const settings = this.#model.lobby?.settings;
    if (this.role !== "host" || settings?.mode !== "epic") return;
    this.#say({ ch: "room", kind: "lobby-set", settings: { tableRules: withEpicStart(settings.tableRules, start) } });
  }

  /** Table host: its wait for the pod coordinator has stuck (or cleared); the state carries it for the UI. */
  setPodStuck(stuck: boolean): void {
    this.#model.setPodStuck(stuck);
    this.#publish();
  }

  /** Chooses which tables' logs this device receives. A table it hosts or holds a seat at always comes. */
  followTables(tables: "all" | readonly string[]): void {
    this.#followChosen = tables;
    this.#syncFollow();
    this.#publish();
  }

  /** The organizer gives up a table (plan Q-C (b)); the game goes on without it. */
  dropTable(table: string): void {
    this.#coordinator?.dropTable(table);
  }

  /**
   * Where a table host puts a pod message: the socket, or (the organizer's own table) the coordinator on this device.
   * False when it could not be sent.
   */
  podSend(message: ClientMessage): boolean {
    if (message.ch === "pod" && message.kind === "event" && this.role === "host") {
      if (message.table === this.hostedTable) {
        this.#receivePod(message.table, message.seq, message.event);
        return true;
      }
    }
    return this.#socket?.send(message) ?? false;
  }

  /** The groups of the game as the lobby sets them, in table order. Null until the lobby has tables. */
  #podGroups(): readonly PodCoordinatorGroupSetup[] | null {
    const lobby = this.#model.lobby;
    if (!lobby?.tables || lobby.tables.length === 0) return null;
    return lobby.tables.map((t) => ({
      groupId: t.id as PodCoordinatorGroupSetup["groupId"],
      podId: t.pod,
      players: Math.min(4, Math.max(1, seatsAt(lobby.seats, t.id, FIRST_TABLE))),
    }));
  }

  /**
   * A table host's pod event for the coordinator. A sync is kept (the latest per table) until a coordinator has taken
   * it, so a start that failed on storage and recovers later still answers it without another inbound message.
   */
  #receivePod(table: string, seq: number, event: Parameters<EpicCoordinator["receive"]>[2]): void {
    const sync = (event as { type?: string }).type === "podSync";
    if (sync) this.#pendingSyncs.set(table, { seq, event });
    void this.#withCoordinator((coordinator) => {
      if (!sync) coordinator.receive(table, seq, event);
      this.#drainSyncs(coordinator);
    });
  }

  #drainSyncs(coordinator: EpicCoordinator): void {
    const pending = [...this.#pendingSyncs];
    this.#pendingSyncs.clear();
    for (const [table, p] of pending)
      coordinator.receive(table, p.seq, p.event as Parameters<EpicCoordinator["receive"]>[2]);
  }

  #cancelCoordinatorRetry(): void {
    if (this.#coordinatorRetry !== null) this.#timers.clearTimer(this.#coordinatorRetry);
    this.#coordinatorRetry = null;
    this.#pendingSyncs.clear();
  }

  /** A clear or a restore failed: the pod is stuck, and the start is tried again after 1 s, 2 s, 4 s... up to 30 s. */
  #scheduleCoordinatorRetry(): void {
    this.setPodStuck(true);
    if (this.#coordinatorRetry !== null || this.#closed) return;
    const delay = Math.min(30_000, 1000 * 2 ** this.#coordinatorRetryAttempt++);
    this.#coordinatorRetry = this.#timers.setTimer(() => {
      this.#coordinatorRetry = null;
      if (this.#closed) return;
      void this.#withCoordinator((coordinator) => this.#drainSyncs(coordinator));
    }, delay);
  }

  /** Runs `use` on the organizer's coordinator, once it exists (it restores its saved log first). */
  #withCoordinator(use: (coordinator: EpicCoordinator) => void): Promise<void> {
    if (this.role !== "host") return Promise.resolve();
    this.#refreshCoordinator();
    const start = (this.#coordinatorStart ??= this.#startCoordinator());
    return start.then((coordinator) => {
      // No lobby tables yet: nothing to coordinate, and the next call tries again.
      if (!coordinator && this.#coordinatorStart === start) this.#coordinatorStart = null;
      if (!coordinator && this.#coordinatorStartFailed && !this.#closed) this.#scheduleCoordinatorRetry();
      if (coordinator && !this.#closed) {
        // The organizer's welcome came while no coordinator could start: announce the new epoch as soon as one exists, so
        // table hosts that stayed connected sync again and re-send what the room dropped.
        if (this.#epochToAnnounce) {
          this.#epochToAnnounce = false;
          coordinator.renewEpoch();
          coordinator.broadcast();
        }
        use(coordinator);
      }
    });
  }

  /**
   * A coordinator made from an earlier lobby (tables, pods or seat counts edited since) that has heard nothing yet is
   * thrown away: the next one is made from the lobby as it stands. Once a game has begun the room locks the lobby.
   */
  #refreshCoordinator(): void {
    // One coordinator per game: the tables ended, and then one begins again (a rematch in this room, perhaps with the
    // very same tables, pods and seats). The old log and counts would answer the new game's first events as duplicates.
    const over = this.#model.allTablesEnded;
    if (this.#coordinator?.state && over && !this.#coordinatorGameOver) {
      this.#coordinatorGameOver = true;
      // Saved as finished, so a reload before the rematch (when no table has spoken yet) does not restore it for the new game.
      void this.#coordinator.markEnded();
    }
    if (this.#coordinatorGameOver && !over) {
      const old = this.#coordinator;
      old?.dispose();
      if (old) this.#coordinatorClear = () => old.clearSaved();
      this.#coordinator = null;
      this.#coordinatorStart = null;
      this.#coordinatorGameOver = false;
    }
    const key = JSON.stringify(this.#podGroups());
    if (this.#coordinatorStart === null || key === this.#coordinatorKey) return;
    const current = this.#coordinator;
    if (current?.state) return;
    current?.dispose();
    this.#coordinator = null;
    this.#coordinatorStart = null;
  }

  async #startCoordinator(): Promise<EpicCoordinator | null> {
    const groups = this.#podGroups();
    this.#coordinatorKey = JSON.stringify(groups);
    const roomId = this.#model.roomId;
    this.#coordinatorStartFailed = false;
    if (!groups || !roomId) return null;
    // The old game's record must be gone before a restore could read it: if the delete fails, no coordinator is made
    // (the next event tries again) rather than one that carries the old game's log and counts.
    while (this.#coordinatorClear) {
      try {
        await this.#coordinatorClear();
        this.#coordinatorClear = null;
      } catch {
        this.#coordinatorStartFailed = true;
        return null;
      }
    }
    // The organizer's own table, read at each delivery: the coordinator starts with the first lobby broadcast, before the
    // room has named this device its own table's host, so a table read now would send its answers (the sync ack above
    // all) to the socket instead of its own link, which then never syncs and holds its events.
    const localOf = (): EpicCoordinatorOptions["local"] | undefined => {
      const table = this.hostedTable;
      return table
        ? {
            table,
            deliver: (seq, event) =>
              this.#hooks?.onMessage({ v: 1, ch: "pod", kind: "inbound", table, seq, event } as ServerMessage),
          }
        : undefined;
    };
    let coordinator: EpicCoordinator;
    try {
      coordinator = await EpicCoordinator.restore({
        roomId,
        groups,
        send: (message) => this.#socket?.send(message as ClientMessage) ?? false,
        get local() {
          return localOf();
        },
        ...(this.#deps.epicStore ? { store: this.#deps.epicStore } : {}),
        ...(this.#deps.now ? { now: this.#deps.now } : {}),
        setTimer: (run, ms) => this.#timers.setTimer(run, ms),
        clearTimer: (handle) => this.#timers.clearTimer(handle),
        // The log will not save: what depends on it is held, and the pod shows as stuck until a save commits.
        onSaveStatus: (status) => this.setPodStuck(status.stuck),
        onState: (state) => {
          this.#model.setPodState(state);
          // The organizer's own table's link reads the broadcast too (how many of its events the coordinator has).
          this.#hooks?.onMessage({ v: 1, ch: "pod", kind: "state", state });
          this.#publish();
        },
      });
    } catch {
      // The record would not read or delete: no coordinator, so none answers from nothing. A retry starts again.
      this.#coordinatorStartFailed = true;
      return null;
    }
    this.#coordinator = coordinator;
    if (this.#coordinatorRetry !== null) this.#timers.clearTimer(this.#coordinatorRetry);
    this.#coordinatorRetry = null;
    this.#coordinatorRetryAttempt = 0;
    this.setPodStuck(false);
    // A reload after the game ended (the organizer was away when the last table finished): the record restored here
    // belongs to that game, so it is marked finished now, before a rematch's first table can speak to it.
    if (coordinator.state && this.#model.allTablesEnded && !this.#coordinatorGameOver) {
      this.#coordinatorGameOver = true;
      void coordinator.markEnded();
    }
    return coordinator;
  }

  /** This device's game is another table's to watch: it has no seat and runs no table (an organizer with none, a guest). */
  get canWatch(): boolean {
    return this.role === "guest" || (this.hostedTable === null && this.#epic());
  }

  /**
   * Epic: watch `table` in place of whatever this device watches now. Only a device with no seat and no table of its
   * own may (a seat holder watches its own table). Follows just that table and shows what has arrived of it; an open
   * feed is closed, and its owner opens the new table's (`platform/room.ts` `watchTable`). False when it cannot.
   */
  watchTable(table: string): boolean {
    const lobby = this.#model.lobby;
    if (!this.canWatch || !lobby?.tables?.some((t) => t.id === table)) return false;
    if (this.#model.state().mySeats.length > 0 || this.#model.hostedTable !== null) return false;
    this.#watchOverride = table;
    this.followTables([table]);
    this.#syncView();
    return true;
  }

  /** Tells the room which tables this device follows: its choice, else only its own table once it has one. */
  #syncFollow(): void {
    if (!this.#epic()) return;
    const own = this.hostedTable !== null || this.#model.state().mySeats.length > 0;
    const follow = this.#followChosen ?? (own ? [] : "all");
    this.#model.setFollow(follow);
    const key = JSON.stringify(follow);
    if (key === this.#followSent) return;
    if (this.#socket?.send({ v: ROOM_PROTOCOL_VERSION, ch: "room", kind: "follow", tables: follow })) {
      this.#followSent = key;
    }
  }

  /** The table whose game this device shows: its own, else the first it follows, else the first table. */
  #syncView(): void {
    const lobby = this.#model.lobby;
    const me = this.#model.meId;
    let view = FIRST_TABLE;
    if (lobby?.settings.mode === "epic") {
      const seat = lobby.seats.find((s) => s.holder === me);
      const follow = this.#model.follow;
      view =
        this.#model.hostedTable ??
        seat?.table ??
        (seat ? FIRST_TABLE : undefined) ??
        this.#watchOverride ??
        (Array.isArray(follow) ? follow[0] : undefined) ??
        lobby.tables?.[0]?.id ??
        FIRST_TABLE;
    }
    if (view === this.#model.view) return;
    this.#model.setView(view);
    // A game feed already open was following another table: it is closed, and its owner opens the new one.
    this.unfollow();
    this.#publish();
  }

  #mirrorOf(table: string): GameMirror {
    let mirror = this.#mirrors.get(table);
    if (!mirror) {
      mirror = new GameMirror(table);
      this.#mirrors.set(table, mirror);
    }
    return mirror;
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

  /**
   * Host: answers a seat holder's request (`RoomState.requests`); the caller has already done what an accepted one asks.
   * A request already gone (answered, or its asker left) is ignored.
   */
  answerRequest(id: string, accepted: boolean): void {
    if (!this.hosting) return;
    const request = this.#model.takeRequest(id);
    if (!request) return;
    this.#say({
      ch: "game",
      kind: "request-answer",
      table: this.hostedTable ?? FIRST_TABLE,
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
    this.#say({
      ch: "game",
      kind: "request",
      table: this.#model.view,
      what,
      note: note.trim().slice(0, 140),
      rid,
    });
    this.#publish();
  }

  /** Guest: dismisses the answer to my last request. */
  clearAsk(): void {
    this.#model.clearAsk();
    this.#publish();
  }

  /** Host: turns a proposal down (the engine worker's verdict); the room tells the proposer alone. */
  refuseProposal(to: string, reason: ProposalRefusal, base: number, pid?: number): void {
    if (!this.hosting) return;
    this.#say({
      ch: "game",
      kind: "proposal-refused",
      table: this.hostedTable ?? FIRST_TABLE,
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
    if (!this.hosting) return;
    const body: Body = {
      ch: "game",
      kind: "proposal-accepted",
      table: this.hostedTable ?? FIRST_TABLE,
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
    // The room's host, or an Epic table host (which gets its own table's seats only).
    if (!this.hosting || !this.#socket?.connected) return Promise.resolve(null);
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
    if (!this.hosting) return;
    this.#say({ ch: "room", kind: "deck-refused", seat, code, reason });
  }

  /** Host only: which setup step I am in. Ephemeral: the room relays it, keeps it in memory and never stores it. */
  hostActivity(step: HostActivityStep, scenario?: string): void {
    if (this.role !== "host") return;
    this.#say({ ch: "room", kind: "host-activity", step, ...(scenario ? { scenario } : {}) });
  }

  chat(text: string): void {
    if (text.trim().length === 0) return;
    this.#say({ ch: "chat", kind: "say", text });
  }

  // -- a guest's feed ---------------------------------------------------------------------------------------------

  /** Guest: the watcher takes the room's game over `port`: first what has arrived, then everything as it comes. */
  follow(port: FeedPort, feedId?: number): void {
    this.unfollow();
    this.#feed = port;
    this.#feedId = feedId;
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
    // The seat worker thinks it is in a one-table room: its proposal goes to the table it really follows.
    if (message) this.#say({ ...message, table: this.#model.view });
  }

  /** Closes the feed (`feedId`, when given, must be the open one: a closed old watch must not close its successor). */
  unfollow(feedId?: number): void {
    if (feedId !== undefined && feedId !== this.#feedId) return;
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
    const t = this.#model.tableInfo(this.hostedTable ?? FIRST_TABLE) ?? this.#model.table;
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
      seatTokens: () =>
        Object.entries(this.#tokens)
          .filter(([key]) => !key.startsWith(TABLE_KEY))
          .map(([, token]) => token),
      tableTokens: () =>
        Object.entries(this.#tokens)
          .filter(([key]) => key.startsWith(TABLE_KEY))
          .map(([, token]) => token),
      deps: this.#timers,
      onConnection: (connected) => {
        if (this.#socket !== socket || connected) return;
        this.#model.dropped();
        this.#followSent = "";
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
      // The guest's own table (in an Epic room, the one this device follows) is the game it keeps.
      const game = this.#mirrorOf(this.#model.view).salvage();
      if (game) this.#deps.onSalvage?.(game);
    }
    this.#model.ended(problem);
    this.#answerDecks(null);
    this.#socket?.close();
    this.#socket = null;
    const hooks = this.#hooks;
    this.#hooks = null;
    this.#clearGapTimer();
    this.#cancelCoordinatorRetry();
    this.#coordinator?.dispose();
    // The room is gone or ended for good: its pod log has nothing left to resume (a replaced socket keeps it).
    const epicRoom = this.#model.roomId;
    if (this.role === "host" && epicRoom && (problem === "gone" || problem.startsWith("closed-")))
      void this.#deps.epicStore?.clear(epicRoom).catch(() => {});
    // A closed room already reached the watcher as a `closed` message; any other end tells it to stop following.
    this.#feed?.postMessage(
      problem.startsWith("closed-") ? { kind: "connection", connected: false } : { kind: "gone" },
    );
    this.#publish();
    hooks?.onEnded();
  }

  /**
   * The pod channel (Epic rooms). The organizer's coordinator takes the table hosts' events; a table host's link takes the
   * organizer's answers and state; everyone's model takes the shared state.
   */
  #onPod(message: Extract<ServerMessage, { ch: "pod" }>): void {
    if (message.kind === "event") {
      if (this.role !== "host") return;
      const { table, seq, event } = message;
      this.#receivePod(table, seq, event);
      return;
    }
    if (message.kind === "state" && this.role !== "host" && this.#model.onMessage(message)) this.#publish();
    this.#hooks?.onMessage(message);
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
    if (
      message.ch === "room" &&
      message.kind === "welcome" &&
      this.role === "guest" &&
      message.you.role !== "host" &&
      Object.keys(this.#tokens).some((key) => key.startsWith(TABLE_KEY))
    ) {
      // Table host tokens the room no longer honours: this device hosts no table any more.
      for (const key of Object.keys(this.#tokens)) if (key.startsWith(TABLE_KEY)) delete this.#tokens[key];
      this.#saveTokens();
      const hooks = this.#hooks;
      this.#hooks = null;
      hooks?.onEnded();
    }
    if (message.ch === "room" && message.kind === "sealed") {
      // Only the host's own reveal answer, never a state: the scenarios leave this worker once, to the main thread.
      if (this.role === "host")
        this.#deps.onSealed?.({ registration: message.registration, resistance: message.resistance }, message.rev ?? 0);
      return;
    }
    if (message.ch === "room" && message.kind === "welcome" && this.#pendingScenario) {
      const { team, scenario } = this.#pendingScenario;
      this.#pendingScenario = null;
      this.submitScenario(team, scenario);
    }
    if (message.ch === "room" && message.kind === "table-host-token") {
      // Private to this device: kept and presented as `hello.tableTokens`, never shown. It makes this device a host.
      this.#tokens[`${TABLE_KEY}${message.table}`] = message.token;
      this.#saveTokens();
      return;
    }
    if (message.ch === "pod") {
      this.#onPod(message);
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
      if (this.hosting) this.#answerDecks(message.decks);
      return;
    }
    if (message.ch === "room" && message.kind === "refused" && SEAT_REFUSED_TO_CLOSE.has(message.reason)) {
      this.#model.onMessage(message);
      this.#over(message.reason === "full" ? "full" : "no-name");
      return;
    }
    if (this.hosting && message.ch === "game" && message.kind === "proposal") {
      this.#onProposal(message);
      return;
    }
    if (this.hosting && message.ch === "game" && message.kind === "request") {
      // The room refuses requests in a Strict room itself; one that slips through is declined, never listed.
      if (!askAllowedOf(message.what, this.#model.state().settings)) {
        this.#say({
          ch: "game",
          kind: "request-answer",
          table: this.hostedTable ?? FIRST_TABLE,
          to: message.from,
          accepted: false,
          ...(message.rid === undefined ? {} : { rid: message.rid }),
        });
        return;
      }
    }
    const changed = this.#model.onMessage(message);
    if (
      this.role === "host" &&
      ((message.ch === "room" && message.kind === "table") || (message.ch === "game" && message.kind === "end"))
    )
      this.#refreshCoordinator();
    if (message.ch === "room" && message.kind === "lobby") {
      this.#awaitingLobby = false;
      this.#pruneTokens();
      this.#syncView();
      this.#syncFollow();
      // A request the lobby no longer lists (the room woke from hibernation and forgot it; the socket survives that, so
      // there is no welcome) is sent again. A denied one was told to us (`seat-denied`) and is no longer wanted.
      for (const seat of this.#model.lostRequests()) this.#say({ ch: "room", kind: "seat-request", seat });
    }
    if (this.role === "host" && message.ch === "room" && message.kind === "welcome") {
      // The organizer is back (or new): a new epoch makes every table host sync again and re-send what the room dropped
      // while it was away; its coordinator, when it has state, says so to everyone.
      this.#epochToAnnounce = true;
      void this.#withCoordinator(() => {});
    }
    if (this.role === "host" && message.ch === "room" && message.kind === "lobby" && this.#epic()) {
      void this.#withCoordinator((coordinator) => coordinator.broadcast());
    }
    if (message.ch === "room" && (message.kind === "welcome" || message.kind === "roster")) {
      // Who runs which table can change with the roster (a promotion to table host): the view and follow follow it.
      if (message.kind === "welcome") {
        this.#followSent = "";
        this.#awaitingLobby = true;
      }
      if (!this.#awaitingLobby) this.#syncView();
      this.#syncFollow();
    }
    if (this.canWatch) this.#guestMessage(message);
    if (this.hosting && message.ch === "room" && message.kind === "welcome") {
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
      if (seat.startsWith(TABLE_KEY)) {
        // A table host token whose table another host took over (or that has none now) is of no more use.
        const table = lobby.tables?.find((t) => `${TABLE_KEY}${t.id}` === seat);
        if (lobby.tables !== undefined && (!table || (table.host !== undefined && table.host !== me))) {
          delete this.#tokens[seat];
          dropped = true;
        }
        continue;
      }
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
    if (message.ch === "game" && "table" in message) {
      const result = this.#mirrorOf(message.table).apply(message);
      if (result === "gap") {
        // Not a log this side can follow: the room sends a fresh one on the next connection.
        this.#reconnect();
        return;
      }
    }
    // The watcher follows the game and who is in the room; chat, the lobby and tokens are the lobby's own.
    if (message.ch === "game" || (message.ch === "room" && FEED_ROOM_KINDS.has(message.kind))) {
      const aliased = aliasTable(message, this.#model.view, FIRST_TABLE);
      if (aliased) this.#feed?.postMessage({ kind: "server", message: aliased });
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
    for (const mirror of this.#mirrors.values()) mirror.clear(true);
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
    const aliasedWelcome = welcome ? aliasTable(welcome, this.#model.view, FIRST_TABLE) : null;
    if (aliasedWelcome) feed.postMessage({ kind: "server", message: aliasedWelcome });
    for (const message of this.#mirrorOf(this.#model.view).snapshot()) {
      const aliased = aliasTable(message, this.#model.view, FIRST_TABLE);
      if (aliased) feed.postMessage({ kind: "server", message: aliased });
    }
  }
}
