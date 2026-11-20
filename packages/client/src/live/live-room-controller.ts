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
  reconnectDelay,
  RoomSocket,
  type CreateRoomDeps,
  type CreateRoomResult,
  type RoomSocketDeps,
} from "./room-socket.js";
import { LivePublisher, NO_LIVE_STATUS, type LiveStatus } from "./live-publisher.js";
import type { RoomBuild } from "@mc/sync-worker/room-protocol";
import type { LiveGameMessage, LiveRoomIn } from "./live-room-protocol.js";
import { recordFresh, type LiveRoomRecord, type LiveRoomStore } from "./live-room-store.js";
import { RoomSession, type FeedPort, type GameHooks, type RoomSessionDeps } from "./room-session.js";
import type { SeatTokenStore } from "./room-seat-store.js";
import { NO_ROOM, type RoomState } from "./room-state.js";

type GameMessage = Extract<LiveGameMessage, { kind: "game" }>;

export interface LiveRoomControllerDeps {
  readonly syncUrl: string | null;
  readonly watchBase: string;
  readonly onStatus: (status: LiveStatus) => void;
  /** Tells the engine worker the stream is up (or not). */
  readonly onEnabledChange?: (on: boolean) => void;
  /** Asks the engine worker for the whole game again (a gap in the log). */
  readonly onResync?: () => void;
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
    readonly seatStore: SeatTokenStore;
    /** The saved online name: what a lobby room resumed after a reload says hello with when its record has none. */
    readonly onlineName?: string;
    readonly onState: (state: RoomState) => void;
    readonly createRoom?: RoomSessionDeps["createRoom"];
    readonly resolveRoomCode?: RoomSessionDeps["resolveRoomCode"];
  };
}

/** Rooms one game may use up (the first, and one replacement for a gone room or a refused token). */
const MAX_ROOMS_PER_GAME = 2;

interface Live {
  readonly gameKey: string;
  readonly publisher: LivePublisher;
  socket: RoomSocket | null;
  /** The lobby's room, when this game streams into the room the host made (its socket is the room session's). */
  room: RoomSession | null;
  rooms: number;
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
        if (session?.role === "host" && !session.ended) this.#openPending(message.gameKey);
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
        else void session.startHost();
        return;
      }
      case "room-join": {
        this.#lastName = message.name.trim();
        const session = this.#newSession("guest", message.name);
        if (message.name.trim() === "") session.failWith("no-name");
        else void session.startGuest(message.target);
        return;
      }
      case "room-leave":
        this.#closeSession();
        return;
      case "room-lobby":
        this.#session?.lobbySet(message);
        return;
      case "room-seat":
        this.#session?.seat(message.op, message.seat, message.participant);
        return;
      case "room-say":
        this.#session?.chat(message.text);
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
      seatStore: room.seatStore,
      onState: (state) => {
        if (this.#session === session) this.#postRoom(state);
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

  #closeSession(): void {
    const session = this.#session;
    if (!session) return;
    // The game streaming into the room is over with it: the room is told, then the socket closes.
    if (this.#live?.room === session) this.#leave();
    this.#session = null;
    session.close();
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
      publisher: new LivePublisher({
        game: game.game,
        watchBase: this.#deps.watchBase,
        send: (m) => (live.room ? live.room.send(m) : (live.socket?.send(m) ?? false)),
        onStatus: (status) => {
          if (this.#live === live) this.#report(status);
        },
        onResync: () => this.#deps.onResync?.(),
        onGiveUp: () => {
          // Past what the room keeps: this game is no longer streamed.
          this.#end(live);
        },
      }),
      socket: null,
      room: null,
      rooms: 0,
      createAttempts: 0,
      retry: null,
      failed: false,
    };
    this.#live = live;
    void this.#begin(live);
  }

  /** A resumed game goes back to the room it had (as host); otherwise, or when that room is no use, a new one. */
  async #begin(live: Live): Promise<void> {
    const store = this.#deps.store;
    const now = (this.#deps.now ?? Date.now)();
    let record = null;
    if (store) {
      try {
        record = await store.load(live.gameKey);
      } catch {
        record = null;
      }
    }
    if (this.#live !== live) return;
    const session = this.#session;
    if (session?.role === "host" && !session.ended) {
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
        this.#attachRoom(live, resumed);
        return;
      }
      // No name to say hello with (a lobby room refuses one without): the old room is no use, the game streams on its own.
      void store?.clear(live.gameKey).catch(() => {});
      await this.#create(live);
      return;
    }
    if (record && record.gameKey === live.gameKey && recordFresh(record, now)) {
      live.rooms++;
      this.#connect(live, record.roomId, record.hostToken);
      return;
    }
    if (record) void store?.clear(live.gameKey).catch(() => {});
    await this.#create(live);
  }

  /** The game streams into the lobby's room, over the lobby's own socket. */
  #attachRoom(live: Live, room: RoomSession): void {
    live.rooms++;
    live.room = room;
    if (room.roomId) live.publisher.roomOpened(room.roomId);
    if (room.roomId && room.hostToken && room.code) {
      const record: LiveRoomRecord = {
        gameKey: live.gameKey,
        roomId: room.roomId,
        hostToken: room.hostToken,
        createdAt: (this.#deps.now ?? Date.now)(),
        code: room.code,
        name: room.name,
      };
      void this.#deps.store?.save(record).catch(() => {});
    }
    const hooks: GameHooks = {
      onWelcome: (table) => live.publisher.onWelcome(table),
      onDisconnected: () => live.publisher.onDisconnected(),
      onMessage: (message) => live.publisher.onMessage(message),
      onEnded: () => this.#end(live),
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
    void this.#deps.store
      ?.save({
        gameKey: live.gameKey,
        roomId: result.room.roomId,
        hostToken: result.room.hostToken,
        createdAt: (this.#deps.now ?? Date.now)(),
      })
      .catch(() => {});
    this.#connect(live, result.room.roomId, result.room.hostToken);
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
            info ? { commands: info.commands, ended: info.ended, hasHeader: info.hasHeader } : undefined,
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
    void this.#deps.store?.clear(live.gameKey).catch(() => {});
    if (live.rooms < MAX_ROOMS_PER_GAME) void this.#create(live);
    else live.failed = true;
  }

  /** This game's stream is over (the room closed, was taken over, or refused the log): the next game starts clean. */
  #end(live: Live): void {
    void this.#deps.store?.clear(live.gameKey).catch(() => {});
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
