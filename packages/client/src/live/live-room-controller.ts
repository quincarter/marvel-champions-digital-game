/**
 * What the live-room worker does, without the worker global so it can be tested: takes the engine worker's game
 * messages (sent only for a game whose setup is `watchable`), creates the room lazily on a game's first new command,
 * keeps a socket and a publisher for it, and reports status.
 *
 * - A new game key is a new room: the old room is told its table is over (`end`, no outcome) and left.
 * - The same game key again (a resume, a resync) keeps the room and reconciles the log (`replaceGame`).
 * - A room that is gone (no such room, never welcomed), or that honours no token of ours (we were made a watcher), is
 *   replaced once by a fresh room fed the same log; a room that closed, or that another device took over, ends the
 *   stream until the next game.
 * - A failed `POST /room` is retried with backoff unless the service said rate-limited or disabled.
 */
import {
  createRoom as defaultCreateRoom,
  defaultSocketDeps,
  parseJoinTarget,
  reconnectDelay,
  RoomSocket,
  type CreateRoomDeps,
  type CreateRoomResult,
  type RoomSocketDeps,
} from "./room-socket.js";
import { gidOfGame, LivePublisher, NO_LIVE_STATUS, type LiveStatus } from "./live-publisher.js";
import type { RoomBuild, RoomDevice } from "@mc/sync-worker/room-protocol";
import type { LiveGameMessage, LiveRoomIn } from "./live-room-protocol.js";
import { lobbyRecordKey, recordFresh, type LiveRoomRecord, type LiveRoomStore } from "./live-room-store.js";
import { RoomSession, type FeedPort, type GameHooks, type RoomSessionDeps } from "./room-session.js";
import type { SeatTokenStore } from "./room-seat-store.js";
import { NO_ROOM, type RoomState, type SeatDeckEntry } from "./room-state.js";

type GameMessage = Extract<LiveGameMessage, { kind: "game" }>;

export interface LiveRoomControllerDeps {
  readonly syncUrl: string | null;
  readonly watchBase: string;
  readonly onStatus: (status: LiveStatus) => void;
  /** Tells the engine worker the stream is up (or not). */
  readonly onEnabledChange?: (on: boolean) => void;
  /** Asks the engine worker for the whole game again (a gap in the log). */
  readonly onResync?: () => void;
  /** The room refused the host's game start because the lobby changed first: the game was dropped from the room. */
  readonly onStartRefused?: () => void;
  /** Remembers each game's room, so a resumed game returns to it as the host. Absent: every game gets a new room. */
  readonly store?: LiveRoomStore;
  readonly now?: () => number;
  readonly createRoom?: (deps: CreateRoomDeps) => Promise<CreateRoomResult>;
  readonly fetch?: typeof fetch;
  /** The socket's and the retry timer's clock and WebSocket (tests). */
  readonly socket?: RoomSocketDeps;
  /** Rooms and the lobby (issue #880). Absent: the room commands do nothing. */
  readonly room?: {
    readonly build: RoomBuild;
    /** This device, said in every hello (the lobby's, and the publisher's for a plain watch room). */
    readonly device?: RoomDevice;
    readonly seatStore: SeatTokenStore;
    /** The saved online name: what a lobby room resumed after a reload says hello with when its record has none. */
    readonly onlineName?: string;
    readonly onState: (state: RoomState) => void;
    /** The host's Start asked for the decks (`room-decks-request`): the answer, or null. */
    readonly onDecks?: (id: number, decks: readonly SeatDeckEntry[] | null) => void;
    readonly createRoom?: RoomSessionDeps["createRoom"];
    readonly resolveRoomCode?: RoomSessionDeps["resolveRoomCode"];
  };
}

/** Problems after which a host's saved room can never be resumed. */
const HOST_ROOM_OVER: ReadonlySet<string> = new Set([
  "not-found",
  "gone",
  "closed-ended",
  "closed-idle",
  "closed-disabled",
  "closed-host",
]);

/** Rooms one game may use up (the first, and one replacement for a gone room or a refused token). */
const MAX_ROOMS_PER_GAME = 2;

/** The saved record's last-activity stamp is rewritten at most this often (the room's own stamp is hourly). */
const TOUCH_EVERY_MS = 60_000;

/** Tries at reading the saved room before failing closed rather than creating a duplicate. */
const MAX_LOOKUPS = 5;

/** Tries at saving a new room's record before failing closed without ever publishing its link. */
const MAX_SAVES = 5;

interface Live {
  readonly gameKey: string;
  /** The lobby room this game was started in (`SessionConfig.room`); only a host session for that room takes it. */
  readonly roomId: string | undefined;
  readonly publisher: LivePublisher;
  socket: RoomSocket | null;
  /** The lobby's room, when this game streams into the room the host made (its socket is the room session's). */
  room: RoomSession | null;
  rooms: number;
  /** The saved record of the room in use, and when its last-activity stamp was written. */
  record: LiveRoomRecord | null;
  touchedAt: number;
  createAttempts: number;
  retry: unknown;
  /** Set when this game will not be streamed any more. */
  failed: boolean;
}

export class LiveRoomController {
  readonly #deps: LiveRoomControllerDeps;
  readonly #timers: RoomSocketDeps;
  #enabled = false;
  #pending: GameMessage | null = null;
  #live: Live | null = null;
  #status: LiveStatus = NO_LIVE_STATUS;
  #session: RoomSession | null = null;
  #roomState: RoomState = NO_ROOM;
  /** The name the last host or join call used. */
  #lastName = "";
  /** Bumped by every session change, so a rejoin whose record read returns late knows it was overtaken. */
  #rejoinTicket = 0;
  /** A host session a rejoin resumed: when its room turns out gone, the code is joined as a guest instead. */
  #hostFallback: { readonly session: RoomSession; readonly name: string; readonly code: string } | null = null;
  /** When the lobby record's stamp was last written while hosting in the lobby. */
  #lobbyStampAt = 0;

  constructor(deps: LiveRoomControllerDeps) {
    this.#deps = deps;
    this.#timers = deps.socket ?? defaultSocketDeps();
  }

  setEnabled(on: boolean): void {
    if (on === this.#enabled) return;
    this.#enabled = on;
    if (!on) this.#leave();
    this.#deps.onEnabledChange?.(on);
  }

  onGameMessage(message: LiveGameMessage): void {
    if (!this.#enabled) return;
    switch (message.kind) {
      case "game": {
        if (this.#live?.gameKey === message.gameKey) {
          this.#live.publisher.replaceGame(message.game);
          return;
        }
        if (this.#pending?.gameKey === message.gameKey) {
          this.#pending = message;
          return;
        }
        this.#leave();
        this.#pending = message;
        // A game started in a hosted lobby, or a lobby room's game resumed after a reload, joins its room at once
        // (the room shows it started) rather than at its first command.
        const session = this.#session;
        if (session && this.#takesGame(session, message.room)) this.#openPending(message.gameKey);
        else if (this.#deps.room) void this.#resumeEarly(message.gameKey);
        return;
      }
      case "command": {
        if (!this.#live && this.#pending?.gameKey === message.gameKey) {
          this.#open(this.#pending);
          this.#pending = null;
        }
        const live = this.#live;
        if (live?.gameKey !== message.gameKey) return;
        live.publisher.command(message.command, message.count, message.checksum, message.outcome);
        this.#touch(live);
        return;
      }
      case "none":
        this.#leave();
        return;
      case "rewind": {
        if (!this.#live && this.#pending?.gameKey === message.gameKey) {
          // Not streamed yet: the held game just needs its log cut.
          const held = this.#pending.game;
          const checksums = Object.fromEntries(
            Object.entries(held.checksums ?? {}).filter(([count]) => Number(count) <= message.to),
          );
          this.#pending = {
            ...this.#pending,
            game: { ...held, commands: held.commands.slice(0, message.to), outcome: null, checksums },
          };
          return;
        }
        if (this.#live?.gameKey === message.gameKey) this.#live.publisher.rewind(message.to);
        return;
      }
    }
  }

  // -- rooms and the lobby (issue #880) ---------------------------------------------------------------------------

  /** One call of `platform/room.ts`. Ignored where the worker was not given room dependencies. */
  onRoomCommand(message: LiveRoomIn): void {
    if (!this.#deps.room) return;
    switch (message.kind) {
      case "room-host": {
        this.#lastName = message.name.trim();
        const session = this.#newSession("host", message.name);
        if (message.name.trim() === "") session.failWith("no-name");
        else void session.startHost().then(() => this.#saveLobbyRecord(session));
        return;
      }
      case "room-rejoin":
        void this.#rejoin(message.code, message.name);
        return;
      case "room-join": {
        this.#lastName = message.name.trim();
        const session = this.#newSession("guest", message.name);
        if (message.name.trim() === "") session.failWith("no-name");
        else void session.startGuest(message.target);
        return;
      }
      case "room-leave":
        this.#closeSession(message.closeRoom === true);
        return;
      case "room-lobby":
        this.#session?.lobbySet(message);
        this.#touchLobby();
        return;
      case "room-seat":
        this.#session?.seat(message.op, message.seat, message.participant);
        return;
      case "room-say":
        this.#session?.chat(message.text);
        this.#touchLobby();
        return;
      case "room-activity":
        this.#session?.hostActivity(message.step, message.scenario);
        return;
      case "room-table-plan":
        this.#session?.tablePlan(message.plan);
        return;
      case "room-deck":
        this.#session?.chooseDeck(message.seat, message.deck);
        return;
      case "room-decks-request": {
        const answer = this.#deps.room.onDecks;
        const session = this.#session;
        if (!session) answer?.(message.id, null);
        else void session.requestDecks().then((decks) => answer?.(message.id, decks));
        return;
      }
      case "room-deck-refuse":
        this.#session?.refuseDeck(message.seat, message.code, message.reason);
        return;
      case "room-follow": {
        const port = message.port as unknown as FeedPort;
        if (this.#session?.role === "guest") this.#session.follow(port);
        else port.close();
        return;
      }
      case "room-unfollow":
        this.#session?.unfollow();
        return;
      default:
        return;
    }
  }

  /**
   * `?room=<CODE>` after a reload: the host token saved for that code puts this device back as the room's host (lobby
   * and game), otherwise it joins as a guest (the stored seat tokens give its seats back).
   */
  async #rejoin(rawCode: string, rawName: string): Promise<void> {
    const name = rawName.trim();
    this.#lastName = name;
    const target = parseJoinTarget(rawCode);
    const code = target && "code" in target ? target.code : null;
    const ticket = ++this.#rejoinTicket;
    let record: LiveRoomRecord | null = null;
    if (code && name !== "") {
      try {
        record = (await this.#deps.store?.load(lobbyRecordKey(code))) ?? null;
      } catch {
        record = null;
      }
    }
    // Another call (a leave, a new host or join) came while the record was being read: that one wins.
    if (ticket !== this.#rejoinTicket || !this.#deps.room) return;
    const now = (this.#deps.now ?? Date.now)();
    if (record && code && recordFresh(record, now)) {
      const session = this.#newSession("host", name);
      this.#hostFallback = { session, name, code };
      session.resumeHost(record.roomId, record.hostToken, code);
      return;
    }
    if (record && code) void this.#deps.store?.clear(lobbyRecordKey(code)).catch(() => {});
    const session = this.#newSession("guest", name);
    if (name === "") session.failWith("no-name");
    else void session.startGuest(code ?? rawCode);
  }

  /** Host activity in the lobby (settings, chat) keeps the saved record fresh as the room's own idle stamp is, at most once a minute. */
  #touchLobby(): void {
    const session = this.#session;
    if (!session || session.role !== "host" || this.#live?.room === session) return;
    const at = (this.#deps.now ?? Date.now)();
    if (at - this.#lobbyStampAt < TOUCH_EVERY_MS) return;
    this.#lobbyStampAt = at;
    this.#saveLobbyRecord(session);
  }

  /** Remembers a hosted lobby room under its code so a reload can find its host token (see `lobbyRecordKey`). */
  #saveLobbyRecord(session: RoomSession): void {
    const store = this.#deps.store;
    const { roomId, hostToken, code } = session;
    if (!store || session.role !== "host" || session.ended || !roomId || !hostToken || !code) return;
    const at = (this.#deps.now ?? Date.now)();
    const record: LiveRoomRecord = {
      gameKey: lobbyRecordKey(code),
      roomId,
      hostToken,
      createdAt: at,
      lastActiveAt: at,
      code,
      name: session.name,
    };
    void store.save(record).catch(() => {});
  }

  /** The state the room last reported (the engine-less tests read it). */
  get roomState(): RoomState {
    return this.#roomState;
  }

  /** Starts a session in place of any earlier one (a host leaving its room ends its game's stream first). */
  #newSession(role: "host" | "guest", name: string): RoomSession {
    this.#closeSession();
    const room = this.#deps.room;
    if (!room) throw new Error("rooms are not set up in this worker");
    const session: RoomSession = new RoomSession(role, name, {
      syncUrl: this.#deps.syncUrl,
      linkBase: this.#deps.watchBase,
      build: room.build,
      ...(room.device ? { device: room.device } : {}),
      seatStore: room.seatStore,
      onState: (state) => {
        if (this.#session !== session) return;
        const fallback = this.#hostFallback;
        if (
          fallback?.session === session &&
          state.connection === "ended" &&
          (state.problem === "gone" || state.problem === "not-found")
        ) {
          // The saved host token is no use (the room is gone, or no longer honours it): try the code as a guest.
          this.#hostFallback = null;
          void this.#deps.store?.clear(lobbyRecordKey(fallback.code)).catch(() => {});
          void this.#newSession("guest", fallback.name).startGuest(fallback.code);
          return;
        }
        if (role === "host" && state.code && state.connection === "ended" && HOST_ROOM_OVER.has(state.problem ?? "")) {
          void this.#deps.store?.clear(lobbyRecordKey(state.code)).catch(() => {});
        }
        this.#postRoom(state);
      },
      ...(this.#deps.now ? { now: this.#deps.now } : {}),
      ...(this.#deps.fetch ? { fetch: this.#deps.fetch } : {}),
      ...(room.createRoom ? { createRoom: room.createRoom } : {}),
      ...(room.resolveRoomCode ? { resolveRoomCode: room.resolveRoomCode } : {}),
      ...(this.#deps.socket ? { socket: this.#deps.socket } : {}),
    });
    this.#session = session;
    return session;
  }

  #closeSession(closeRoom = false): void {
    this.#rejoinTicket++;
    this.#hostFallback = null;
    const session = this.#session;
    if (!session) return;
    // A host who leaves closes its room: the saved host token is no use any more.
    if (session.role === "host" && session.code) {
      void this.#deps.store?.clear(lobbyRecordKey(session.code)).catch(() => {});
    }
    // The game streaming into the room is over with it: the room is told, then the socket closes.
    if (this.#live?.room === session) this.#leave();
    this.#session = null;
    session.close({ closeRoom });
    this.#postRoom(NO_ROOM);
  }

  #postRoom(state: RoomState): void {
    this.#roomState = state;
    this.#deps.room?.onState(state);
  }

  #openPending(gameKey: string): void {
    if (this.#live || this.#pending?.gameKey !== gameKey) return;
    this.#open(this.#pending);
    this.#pending = null;
  }

  /** A saved game whose record names a lobby room joins it before its first command. */
  async #resumeEarly(gameKey: string): Promise<void> {
    let record: LiveRoomRecord | null = null;
    try {
      record = (await this.#deps.store?.load(gameKey)) ?? null;
    } catch {
      return;
    }
    if (record?.code && recordFresh(record, (this.#deps.now ?? Date.now)())) this.#openPending(gameKey);
  }

  #open(game: GameMessage): void {
    const live: Live = {
      gameKey: game.gameKey,
      roomId: game.room,
      publisher: new LivePublisher({
        game: game.game,
        gid: gidOfGame(game.gameKey, game.game.createdAt),
        watchBase: this.#deps.watchBase,
        send: (m) => (live.room ? live.room.send(m) : (live.socket?.send(m) ?? false)),
        onStatus: (status) => {
          if (this.#live === live) this.#report(status);
        },
        onResync: () => this.#deps.onResync?.(),
        onAdmitted: (gid) => {
          const record = live.record;
          if (!record || record.gid === gid) return;
          // The gid is deterministic (`gidOfGame`), so this record is a convenience: a failed write is not marked as
          // persisted and the next callback (ack, welcome, repair) tries again.
          const next = { ...record, gid };
          const store = this.#deps.store;
          if (!store) {
            live.record = next;
            return;
          }
          void store.save(next).then(
            () => {
              if (live.record === record) live.record = next;
            },
            () => {},
          );
        },
        onLobbyChanged: () => {
          this.#end(live);
          this.#deps.onStartRefused?.();
        },
        onGiveUp: () => {
          // Past what the room keeps: this game is no longer streamed.
          this.#end(live);
        },
      }),
      socket: null,
      room: null,
      rooms: 0,
      record: null,
      touchedAt: 0,
      createAttempts: 0,
      retry: null,
      failed: false,
    };
    this.#live = live;
    void this.#begin(live);
  }

  /** A resumed game goes back to the room it had (as host); otherwise, or when that room is no use, a new one. */
  async #begin(live: Live, lookups = 0): Promise<void> {
    const store = this.#deps.store;
    const now = (this.#deps.now ?? Date.now)();
    let record = null;
    if (store) {
      try {
        record = await store.load(live.gameKey);
      } catch {
        // A read error is not an absent record: a second room would orphan the shared watch link
        // (the first room lost its host). Retry with backoff, then fail closed.
        if (this.#live !== live) return;
        if (lookups + 1 >= MAX_LOOKUPS) {
          live.failed = true;
          return;
        }
        live.retry = this.#timers.setTimer(
          () => {
            live.retry = null;
            if (this.#live === live) void this.#begin(live, lookups + 1);
          },
          reconnectDelay(lookups, this.#timers.random),
        );
        return;
      }
    }
    if (this.#live !== live) return;
    const session = this.#session;
    if (session && this.#takesGame(session, live.roomId)) {
      // The lobby's room may still be being made (the game was started at once): wait for it, never make a plain room.
      await session.ready;
      if (this.#live !== live) return;
      if (session.roomId && session.hostToken && !session.ended) {
        this.#attachRoom(live, session);
        return;
      }
    }
    if (record?.code) {
      const name = (record.name?.trim() || this.#lastName || this.#deps.room?.onlineName?.trim()) ?? "";
      if (name && record.gameKey === live.gameKey && recordFresh(record, now) && this.#deps.room) {
        // A lobby room's host after a reload: back into the same room, lobby and game.
        const resumed = this.#newSession("host", name);
        resumed.resumeHost(record.roomId, record.hostToken, record.code);
        live.publisher.requireAdmittedRoom();
        if (record.gid) live.publisher.adoptGid(record.gid);
        this.#attachRoom(live, resumed, record.gid);
        return;
      }
      // No name to say hello with (a lobby room refuses one without): the old room is no use, the game streams on its own.
      void store?.clear(live.gameKey).catch(() => {});
      await this.#create(live);
      return;
    }
    if (record && record.gameKey === live.gameKey && recordFresh(record, now)) {
      live.rooms++;
      live.record = record;
      live.touchedAt = now;
      this.#connect(live, record.roomId, record.hostToken);
      return;
    }
    if (record) void store?.clear(live.gameKey).catch(() => {});
    await this.#create(live);
  }

  /**
   * A hosted lobby room takes a game only when the game was started in that very room (`SessionConfig.room`): the room
   * stays open after its game, and a later single-player game must not attach to it (issue #880).
   */
  #takesGame(session: RoomSession, room: string | undefined): boolean {
    return session.role === "host" && !session.ended && room !== undefined && room === session.roomId;
  }

  /** The game streams into the lobby's room, over the lobby's own socket. */
  #attachRoom(live: Live, room: RoomSession, gid?: string): void {
    live.rooms++;
    live.room = room;
    if (room.roomId) live.publisher.roomOpened(room.roomId);
    if (room.roomId && room.hostToken && room.code) {
      const at = (this.#deps.now ?? Date.now)();
      const record: LiveRoomRecord = {
        gameKey: live.gameKey,
        roomId: room.roomId,
        hostToken: room.hostToken,
        createdAt: at,
        lastActiveAt: at,
        code: room.code,
        name: room.name,
        ...(gid ? { gid } : {}),
      };
      // The lobby room's record follows the host's activity too (#touch), so a reload past 12 hours finds it fresh.
      live.record = record;
      live.touchedAt = at;
      void this.#deps.store?.save(record).catch(() => {});
    }
    const hooks: GameHooks = {
      onWelcome: (table) => live.publisher.onWelcome(table),
      onDisconnected: () => live.publisher.onDisconnected(),
      onMessage: (message) => live.publisher.onMessage(message),
      // Another tab took the host socket (`replaced`): that tab still depends on the saved records, so they stay.
      onEnded: (problem) => this.#end(live, problem === "replaced"),
    };
    room.attachGame(hooks);
  }

  async #create(live: Live): Promise<void> {
    const create = this.#deps.createRoom ?? defaultCreateRoom;
    const result = await create({
      baseUrl: this.#deps.syncUrl,
      fetch: this.#deps.fetch ?? ((...args) => globalThis.fetch(...args)),
    });
    if (this.#live !== live) return;
    if (!result.ok) {
      if (result.failure === "unavailable" && this.#deps.syncUrl) {
        live.retry = this.#timers.setTimer(
          () => {
            live.retry = null;
            if (this.#live === live) void this.#create(live);
          },
          reconnectDelay(live.createAttempts++, this.#timers.random),
        );
      } else {
        live.failed = true;
      }
      return;
    }
    live.createAttempts = 0;
    live.rooms++;
    const at = (this.#deps.now ?? Date.now)();
    live.record = {
      gameKey: live.gameKey,
      roomId: result.room.roomId,
      hostToken: result.room.hostToken,
      createdAt: at,
      lastActiveAt: at,
    };
    live.touchedAt = at;
    void this.#persistThenConnect(live, live.record);
  }

  /**
   * The new room's record (its host token) is durable before anything is published or the link is shown: a lost token
   * with a shared link would orphan the spectators, and the next controller would make a different room. A failed save
   * is retried (the same record, never a second room) with backoff, then this game fails closed unpublished (the
   * room, never announced, idles out on its own).
   */
  async #persistThenConnect(live: Live, record: LiveRoomRecord, saves = 0): Promise<void> {
    const store = this.#deps.store;
    if (store) {
      try {
        await store.save(record);
      } catch {
        if (this.#live !== live || live.record !== record) return;
        if (saves + 1 >= MAX_SAVES) {
          live.record = null;
          live.failed = true;
          return;
        }
        live.retry = this.#timers.setTimer(
          () => {
            live.retry = null;
            if (this.#live === live && live.record === record) void this.#persistThenConnect(live, record, saves + 1);
          },
          reconnectDelay(saves, this.#timers.random),
        );
        return;
      }
    }
    if (this.#live !== live || live.record !== record) return;
    this.#connect(live, record.roomId, record.hostToken);
  }

  /** Host activity keeps the room alive on the server, so the saved record's stamp follows it (throttled). */
  #touch(live: Live): void {
    const store = this.#deps.store;
    const record = live.record;
    if (!store || !record) return;
    const at = (this.#deps.now ?? Date.now)();
    if (at - live.touchedAt < TOUCH_EVERY_MS) return;
    live.touchedAt = at;
    live.record = { ...record, lastActiveAt: at };
    void store.save(live.record).catch(() => {});
    if (live.room) this.#saveLobbyRecord(live.room);
  }

  #connect(live: Live, roomId: string, hostToken: string): void {
    const baseUrl = this.#deps.syncUrl;
    if (!baseUrl) return;
    live.publisher.roomOpened(roomId);
    const socket: RoomSocket = new RoomSocket({
      baseUrl,
      roomId,
      token: hostToken,
      caps: ["watch"],
      ...(this.#deps.room?.device ? { device: this.#deps.room.device } : {}),
      deps: this.#timers,
      onConnection: (connected) => {
        if (!connected && live.socket === socket) live.publisher.onDisconnected();
      },
      onMessage: (message) => {
        if (live.socket !== socket) return;
        if (message.ch === "room" && message.kind === "welcome") {
          if (message.you.role !== "host") {
            // A token the room no longer honours silently joins as a watcher: this room is not ours to stream into.
            this.#replaceRoom(live);
            return;
          }
          const info = message.tables.find((t) => t.id === "t1");
          live.publisher.onWelcome(
            info
              ? {
                  commands: info.commands,
                  ended: info.ended,
                  hasHeader: info.hasHeader,
                  ...(info.gid !== undefined ? { gid: info.gid } : {}),
                  ...(info.checkpoint !== undefined ? { checkpoint: info.checkpoint } : {}),
                  ...(info.dirty ? { dirty: true } : {}),
                }
              : undefined,
          );
        }
        live.publisher.onMessage(message);
      },
      onReplaced: () => {
        // Another device took over as this table's host: stop streaming from here.
        this.#end(live);
      },
      onClosed: () => {
        // The room is over (ended or idle): nothing more to send, and the link no longer opens a live game.
        this.#end(live);
      },
      onGone: () => this.#replaceRoom(live),
    });
    live.socket = socket;
    socket.connect();
  }

  /** The room is no use (gone, or not ours): one fresh room takes over the same log, then no more. */
  #replaceRoom(live: Live): void {
    live.socket?.close();
    live.socket = null;
    live.publisher.onDisconnected();
    if (this.#live !== live) return;
    live.record = null;
    void this.#deps.store?.clear(live.gameKey).catch(() => {});
    if (live.rooms < MAX_ROOMS_PER_GAME) void this.#create(live);
    else live.failed = true;
  }

  /** This game's stream is over (the room closed, was taken over, or refused the log): the next game starts clean. */
  #end(live: Live, keepRecords = false): void {
    if (!keepRecords) void this.#deps.store?.clear(live.gameKey).catch(() => {});
    if (live.retry !== null) this.#timers.clearTimer(live.retry);
    live.socket?.close();
    live.socket = null;
    if (live.room) {
      live.room.detachGame();
      live.room = null;
    }
    if (this.#live !== live) return;
    this.#live = null;
    this.#pending = null;
    this.#report(NO_LIVE_STATUS);
  }

  /** Leaves the current game's room (a new game, the stream switched off), telling it the table is over. */
  #leave(): void {
    const live = this.#live;
    live?.publisher.abandon();
    if (live) this.#end(live);
    this.#pending = null;
    this.#report(NO_LIVE_STATUS);
  }

  #report(status: LiveStatus): void {
    const last = this.#status;
    if (last.watchUrl === status.watchUrl && last.watchers === status.watchers && last.connected === status.connected) {
      return;
    }
    this.#status = status;
    this.#deps.onStatus(status);
  }
}
