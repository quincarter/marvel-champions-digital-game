/**
 * What the live-room worker does, without the worker global so it can be tested: takes the engine worker's game
 * messages, creates the room lazily on a game's first new command, keeps a socket and a publisher for it, and reports
 * status. A new game key is a new room; switching the setting off closes the socket and forgets the room.
 */
import type { TableInfo } from "@mc/sync-worker/room-protocol";
import {
  createRoom as defaultCreateRoom,
  RoomSocket,
  type CreateRoomDeps,
  type CreateRoomResult,
  type RoomSocketDeps,
} from "./room-socket.js";
import { LivePublisher, NO_LIVE_STATUS, type LiveStatus } from "./live-publisher.js";
import type { LiveGameMessage } from "./live-room-protocol.js";

export interface LiveRoomControllerDeps {
  readonly syncUrl: string | null;
  readonly watchBase: string;
  readonly onStatus: (status: LiveStatus) => void;
  /** Tells the engine worker whether to stream. */
  readonly onEnabledChange?: (on: boolean) => void;
  readonly createRoom?: (deps: CreateRoomDeps) => Promise<CreateRoomResult>;
  readonly fetch?: typeof fetch;
  readonly socket?: RoomSocketDeps;
}

interface Live {
  readonly gameKey: string;
  readonly publisher: LivePublisher;
  socket: RoomSocket | null;
  /** The room is being made; commands that arrive meanwhile are held by the publisher. */
  creating: boolean;
  failed: boolean;
  /** Rooms made for this game: a token the room no longer honours gets one fresh room, not a loop. */
  rooms: number;
}

export class LiveRoomController {
  readonly #deps: LiveRoomControllerDeps;
  #enabled = false;
  #pending: Extract<LiveGameMessage, { kind: "game" }> | null = null;
  #live: Live | null = null;
  #status: LiveStatus = NO_LIVE_STATUS;

  constructor(deps: LiveRoomControllerDeps) {
    this.#deps = deps;
  }

  setEnabled(on: boolean): void {
    if (on === this.#enabled) return;
    this.#enabled = on;
    if (!on) this.#teardown();
    this.#deps.onEnabledChange?.(on);
  }

  onGameMessage(message: LiveGameMessage): void {
    if (!this.#enabled) return;
    switch (message.kind) {
      case "game":
        this.#teardown();
        this.#pending = message;
        return;
      case "command": {
        if (!this.#live && this.#pending?.gameKey === message.gameKey) this.#open(this.#pending);
        const live = this.#live;
        if (live?.gameKey !== message.gameKey) return;
        live.publisher.command(message.command, message.count, message.checksum, message.outcome);
        return;
      }
      case "rewind": {
        if (this.#pending?.gameKey === message.gameKey && !this.#live) {
          // Not streamed yet: the held game just needs its log cut.
          this.#pending = {
            ...this.#pending,
            game: { ...this.#pending.game, commands: this.#pending.game.commands.slice(0, message.to), outcome: null },
          };
          return;
        }
        if (this.#live?.gameKey === message.gameKey) this.#live.publisher.rewind(message.to);
        return;
      }
    }
  }

  #open(game: Extract<LiveGameMessage, { kind: "game" }>): void {
    const live: Live = {
      gameKey: game.gameKey,
      publisher: new LivePublisher({
        game: game.game,
        watchBase: this.#deps.watchBase,
        send: (m) => live.socket?.send(m) ?? false,
        onStatus: (status) => this.#report(status),
      }),
      socket: null,
      creating: true,
      failed: false,
      rooms: 0,
    };
    this.#live = live;
    void this.#create(live);
  }

  async #create(live: Live): Promise<void> {
    const create = this.#deps.createRoom ?? defaultCreateRoom;
    const result = await create({
      baseUrl: this.#deps.syncUrl,
      fetch: this.#deps.fetch ?? ((...args) => globalThis.fetch(...args)),
    });
    live.creating = false;
    if (this.#live !== live) return;
    if (!result.ok || !this.#deps.syncUrl) {
      live.failed = true;
      return;
    }
    live.rooms++;
    const { roomId, hostToken, table } = result.room;
    live.publisher.roomOpened(roomId);
    live.socket = new RoomSocket({
      baseUrl: this.#deps.syncUrl,
      roomId,
      token: hostToken,
      caps: ["watch"],
      ...(this.#deps.socket ? { deps: this.#deps.socket } : {}),
      onConnection: (connected) => {
        if (!connected) live.publisher.onDisconnected();
      },
      onMessage: (message) => {
        if (message.ch === "room" && message.kind === "welcome") {
          if (message.you.role !== "host") {
            // A stale token silently joins as a watcher: this room is not ours to stream into. Make a new one.
            live.socket?.close();
            live.socket = null;
            live.publisher.onDisconnected();
            if (live.rooms < 2) void this.#create(live);
            else live.failed = true;
            return;
          }
          const info: TableInfo | undefined = message.tables.find((t) => t.id === table);
          live.publisher.onWelcome(info);
        }
        live.publisher.onMessage(message);
      },
      onReplaced: () => {
        // Another device took over as this table's host: stop streaming from here.
        if (this.#live === live) this.#live = null;
        this.#report(NO_LIVE_STATUS);
      },
      onClosed: () => {
        // The room is over (ended or idle): nothing more to send, and the link no longer opens a live game.
        live.socket?.close();
        if (this.#live === live) this.#live = null;
        this.#report(NO_LIVE_STATUS);
      },
    });
    live.socket.connect();
  }

  #teardown(): void {
    this.#live?.socket?.close();
    this.#live = null;
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
