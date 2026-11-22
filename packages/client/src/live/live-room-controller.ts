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
import { gidOfGame, LivePublisher, NO_LIVE_STATUS, type LiveStatus } from "./live-publisher.js";
import type { ClientMessage, RoomBuild, RoomDevice } from "@mc/sync-worker/room-protocol";
import type { LiveControlMessage, LiveGameMessage, LiveRoomIn } from "./live-room-protocol.js";
import type { EpicLogStore } from "./epic-coordinator.js";
import { PodLink } from "./pod-link.js";
import { recordFresh, type LiveRoomRecord, type LiveRoomStore } from "./live-room-store.js";
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
  /** Hands a seat holder's proposal to the engine worker to judge (issue #881). */
  readonly onProposal?: (proposal: Extract<LiveControlMessage, { kind: "proposal" }>) => void;
  /** Hands the pod coordinator's inbound event to the engine worker to apply as a command (Epic Multiplayer). */
  readonly onPodInbound?: (inbound: Extract<LiveControlMessage, { kind: "pod-inbound" | "pod-release" }>) => void;
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
    /** Where the organizer keeps the pod coordinator's log, so a reload rebuilds it (Epic Multiplayer). */
    readonly epicStore?: EpicLogStore;
    /** The saved online name: what a lobby room resumed after a reload says hello with when its record has none. */
    readonly onlineName?: string;
    readonly onState: (state: RoomState) => void;
    /** The host's Start asked for the decks (`room-decks-request`): the answer, or null. */
    readonly onDecks?: (id: number, decks: readonly SeatDeckEntry[] | null) => void;
    /** A guest's room was closed mid-game: the game it held (`RoomSessionDeps.onSalvage`). */
    readonly onSalvage?: RoomSessionDeps["onSalvage"];
    readonly createRoom?: RoomSessionDeps["createRoom"];
    readonly resolveRoomCode?: RoomSessionDeps["resolveRoomCode"];
  };
}

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
  /** Epic Multiplayer: this table's side of the pod channel, when the game is a group of a pod. */
  readonly pod: PodLink | null;
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
          if (message.pod) this.#live.pod?.game(message.pod);
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
        if (message.pod)
          live.pod?.outbound(message.pod.outbound, message.pod.inboundSeq, message.pod.awaiting === true);
        this.#touch(live);
        return;
      }
      case "none":
        this.#leave();
        return;
      case "refuse":
        // The engine worker turned a seat holder's proposal down: only the room can reach them.
        if (this.#live?.gameKey === message.gameKey) {
          this.#live.room?.refuseProposal(message.to, message.reason, message.base, message.pid);
        }
        return;
      case "accept":
        if (this.#live?.gameKey === message.gameKey) {
          this.#live.room?.acceptProposal(message.to, message.base, message.pid);
        }
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
        if (this.#live?.gameKey === message.gameKey) {
          // An acceptance held for a dropped socket for a command this cut removes must not reach the room afterwards.
          this.#live.room?.dropHeldAcceptances(message.to);
          this.#live.publisher.rewind(message.to);
        }
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
        this.#closeSession(message.closeRoom === true);
        return;
      case "room-lobby":
        this.#session?.lobbySet(message);
        return;
      case "room-seat":
        this.#session?.seat(message.op, message.seat, message.participant);
        return;
      case "room-answer":
        this.#session?.answerRequest(message.id, message.accepted);
        return;
      case "room-ask":
        this.#session?.askHost(message.what, message.note);
        return;
      case "room-ask-clear":
        this.#session?.clearAsk();
        return;
      case "room-say":
        this.#session?.chat(message.text);
        return;
      case "room-epic":
        this.#session?.setEpic(message.tables, message.pods, message.seats);
        return;
      case "room-table-host":
        this.#session?.assignTableHost(message.table, message.participant);
        return;
      case "room-follow-tables":
        this.#session?.followTables(message.tables);
        return;
      case "room-epic-start":
        // One shared seed for the game; each table makes its own from it and its id (`tableSeedOf`).
        this.#session?.startEpic({
          id: Math.floor(this.#timers.random() * 0xffffffff).toString(36),
          seed: Math.floor(this.#timers.random() * 0xffffffff),
          at: Date.now(),
        });
        return;
      case "room-pod-release":
        // The table host ends a wait for the coordinator that has stuck: the engine refuses unless it really waits.
        if (this.#live) this.#deps.onPodInbound?.({ kind: "pod-release", gameKey: this.#live.gameKey });
        return;
      case "room-epic-drop":
        this.#session?.dropTable(message.table);
        return;
      case "room-activity":
        this.#session?.hostActivity(message.step, message.scenario);
        return;
      case "room-villain-cursor":
        this.#session?.villainCursor(message.key, message.at, message.state);
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
        if (this.#session?.canWatch) this.#session.follow(port, message.feedId);
        else port.close();
        return;
      }
      case "room-unfollow":
        this.#session?.unfollow(message.feedId);
        return;
      case "room-dev-shared-damage": {
        const live = this.#live;
        if (import.meta.env.DEV && live?.pod) {
          live.pod.injectOutbound({
            type: "sharedVillainDamaged",
            groupId: live.pod.table as never,
            amount: message.amount,
          });
        }
        return;
      }
      case "room-watch-table":
        this.#session?.watchTable(message.table);
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
      ...(room.device ? { device: room.device } : {}),
      seatStore: room.seatStore,
      ...(room.epicStore ? { epicStore: room.epicStore } : {}),
      onState: (state) => {
        if (this.#session === session) this.#postRoom(state);
      },
      ...(this.#deps.now ? { now: this.#deps.now } : {}),
      ...(this.#deps.fetch ? { fetch: this.#deps.fetch } : {}),
      ...(room.createRoom ? { createRoom: room.createRoom } : {}),
      ...(room.resolveRoomCode ? { resolveRoomCode: room.resolveRoomCode } : {}),
      ...(this.#deps.socket ? { socket: this.#deps.socket } : {}),
      ...(room.onSalvage ? { onSalvage: room.onSalvage } : {}),
    });
    this.#session = session;
    return session;
  }

  #closeSession(closeRoom = false): void {
    const session = this.#session;
    if (!session) return;
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
    // A game started in a room streams as the table its device hosts (the first, except in an Epic room).
    const session = this.#session;
    const table = session && this.#takesGame(session, game.room) ? session.hostedTable : null;
    const live: Live = {
      gameKey: game.gameKey,
      roomId: game.room,
      pod: game.pod
        ? this.#podLink(
            game.gameKey,
            game.pod,
            (m) => (live.room ? live.room.podSend(m) : false),
            table,
            (stuck) => live.room?.setPodStuck(stuck),
          )
        : null,
      publisher: new LivePublisher({
        game: game.game,
        ...(table ? { table } : {}),
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

  /** This table's side of the pod channel: events out, inbound events to the engine worker (Epic Multiplayer). */
  #podLink(
    gameKey: string,
    pod: NonNullable<GameMessage["pod"]>,
    send: (message: ClientMessage) => boolean,
    table: string | null,
    onStuck: (stuck: boolean) => void,
  ): PodLink {
    const link = new PodLink({
      table: table ?? pod.groupId,
      send,
      apply: (sequence, event) => this.#deps.onPodInbound?.({ kind: "pod-inbound", gameKey, sequence, event }),
      onStuck,
      setTimer: (run, ms) => this.#timers.setTimer(run, ms),
      clearTimer: (handle) => this.#timers.clearTimer(handle),
    });
    link.game(pod);
    return link;
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
      if (session.roomId && session.canHost && !session.ended) {
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
    // The room's host, or (Epic Multiplayer) a participant the organizer made a table's host: it streams that table.
    return session.hosting && !session.ended && room !== undefined && room === session.roomId;
  }

  /** The game streams into the lobby's room, over the lobby's own socket. */
  #attachRoom(live: Live, room: RoomSession, gid?: string): void {
    live.rooms++;
    live.room = room;
    if (room.roomId) live.publisher.roomOpened(room.roomId);
    if (room.roomId && room.hostToken && room.code && room.role === "host") {
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
      onWelcome: (table) => {
        live.publisher.onWelcome(table);
        live.pod?.onWelcome();
      },
      onDisconnected: () => {
        live.publisher.onDisconnected();
        live.pod?.onDisconnected();
      },
      onMessage: (message) => {
        live.publisher.onMessage(message);
        live.pod?.onMessage(message);
      },
      onEnded: () => this.#end(live),
      onProposal: (proposal) => this.#deps.onProposal?.({ kind: "proposal", gameKey: live.gameKey, ...proposal }),
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
  #end(live: Live): void {
    void this.#deps.store?.clear(live.gameKey).catch(() => {});
    if (live.retry !== null) this.#timers.clearTimer(live.retry);
    live.socket?.close();
    live.socket = null;
    live.pod?.dispose();
    if (live.room) {
      live.room.setPodStuck(false);
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
