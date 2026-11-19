/**
 * The host's side of a live game room (docs/live-game-rooms.md section 5), as plain logic with no socket in it: it
 * holds one game's log (header, commands, checksums), and turns what happens to the game (commands, rewinds, the end)
 * and what happens to the connection (welcome, drop, `resend`, roster) into the room-protocol messages to send.
 *
 * The host always keeps the whole log (the room keeps none on disk), so any `resend` is answered from here. Commands
 * are sent in order as `commands` batches: sent at once while connected, coalesced into one batch while not.
 * Checksums arrive with the command they follow (the engine worker takes one every `CHECKSUM_EVERY` commands, and on
 * the command that ends the game, with `replayChecksum` on the state it already holds) so no state crosses a port
 * per command; they are keyed by command count, as the room expects.
 */
import {
  FIRST_TABLE,
  ROOM_PROTOCOL_VERSION,
  type ClientMessage,
  type ServerMessage,
} from "@mc/sync-worker/room-protocol";
import type { Command, GameOutcome } from "@mc/engine";
import type { SessionConfig, StateWithoutPool } from "../engine/host.js";
import type { ReplayPackRef, ReplayWriter } from "../replay/replay-file.js";

export const LIVE_HEADER_FORMAT = "mc-live";
export const LIVE_HEADER_VERSION = 1;

/**
 * A table's header as the room carries it (opaque to the room): the fields of a `ReplayFile` that exist when a game
 * starts, so a watcher builds a `ReplayFile` from it plus the log (`config` already without the card packs' data and
 * through `withoutDeckNames`, as a replay file's is).
 */
export interface LiveTableHeader {
  readonly format: typeof LIVE_HEADER_FORMAT;
  readonly version: number;
  readonly writer: ReplayWriter;
  readonly config: SessionConfig;
  readonly packs?: readonly ReplayPackRef[];
  readonly createdAt: number;
  readonly initialState: StateWithoutPool;
}

/** What the engine worker knows of a game when the live stream starts (or the setting is switched on mid-game). */
export interface LiveGame {
  readonly writer: ReplayWriter;
  /** Already free of the packs' data and deck names (`live-game.ts`). */
  readonly config: SessionConfig;
  readonly packs?: readonly ReplayPackRef[];
  readonly createdAt: number;
  readonly initialState: StateWithoutPool;
  /** The commands so far: none for a new game, the log for a resumed one. */
  readonly commands: readonly Command[];
  readonly outcome?: GameOutcome | null;
}

export function headerOf(game: LiveGame): LiveTableHeader {
  return {
    format: LIVE_HEADER_FORMAT,
    version: LIVE_HEADER_VERSION,
    writer: game.writer,
    config: game.config,
    ...(game.packs?.length ? { packs: game.packs } : {}),
    createdAt: game.createdAt,
    initialState: game.initialState,
  };
}

/** What the rest of the app learns about the room. */
export interface LiveStatus {
  /** The link a watcher opens; null until the room exists. */
  readonly watchUrl: string | null;
  readonly watchers: number;
  /** The host's socket is up (a room that is not connected is still being kept up to date, then caught up). */
  readonly connected: boolean;
}

export const NO_LIVE_STATUS: LiveStatus = { watchUrl: null, watchers: 0, connected: false };

/** The link that opens a live game: `base` is the web version's address (`replayLinkOf`'s rule, chosen by main). */
export const watchLinkOf = (roomId: string, base: string): string => `${base}#watch=${roomId}`;

export interface LivePublisherOptions {
  readonly game: LiveGame;
  /** Puts a message on the socket; false when it could not be sent (nothing went out). */
  readonly send: (message: ClientMessage) => boolean;
  readonly onStatus: (status: LiveStatus) => void;
  /** The web version's address the watch link hangs off (see `watchLinkOf`). */
  readonly watchBase: string;
  readonly table?: string;
}

export class LivePublisher {
  readonly #send: (message: ClientMessage) => boolean;
  readonly #onStatus: (status: LiveStatus) => void;
  readonly #watchBase: string;
  readonly #table: string;
  readonly #header: LiveTableHeader;
  readonly #commands: Command[];
  /** Checksums by command count (a string key, as the room has them). */
  readonly #checksums: Record<string, string> = {};
  #roomId: string | null = null;
  #connected = false;
  /** The room has this game's header on the current connection. */
  #started = false;
  /** How many commands the room has, as far as this side knows. */
  #sent = 0;
  #outcome: GameOutcome | null;
  #endSent = false;
  #watchers = 0;
  #last: LiveStatus = NO_LIVE_STATUS;

  constructor(options: LivePublisherOptions) {
    this.#send = options.send;
    this.#onStatus = options.onStatus;
    this.#watchBase = options.watchBase;
    this.#table = options.table ?? FIRST_TABLE;
    this.#header = headerOf(options.game);
    this.#commands = [...options.game.commands];
    this.#outcome = options.game.outcome ?? null;
  }

  /** The room was created: from now on the status carries the watch link. */
  roomOpened(roomId: string): void {
    this.#roomId = roomId;
    this.#report();
  }

  /** The command number `count` (so `count` commands now) was applied, with its checksum when one is due. */
  command(command: Command, count: number, checksum?: string, outcome?: GameOutcome | null): void {
    if (count !== this.#commands.length + 1) return;
    this.#commands.push(command);
    if (checksum !== undefined) this.#checksums[String(count)] = checksum;
    if (outcome) {
      this.#outcome = outcome;
      this.#endSent = false;
    }
    this.#flush();
  }

  /** An Undo or Back out cut the log to its first `to` commands. */
  rewind(to: number): void {
    if (to < 0 || to > this.#commands.length) return;
    this.#commands.length = to;
    for (const key of Object.keys(this.#checksums)) if (Number(key) > to) delete this.#checksums[key];
    this.#outcome = null;
    this.#endSent = false;
    if (this.#sent > to) {
      if (
        this.#connected &&
        this.#started &&
        this.#sendMessage({ ch: "game", kind: "rewind", table: this.#table, to })
      ) {
        this.#sent = to;
      }
      // Not sent (disconnected): the welcome's command count says the room is ahead, and `onWelcome` rewinds it then.
    }
    this.#flush();
  }

  /**
   * The socket is welcomed. `table` is what the room says it has of this table (absent: nothing, so the header and the
   * whole log go out). A room ahead of this log is rewound to it; one behind is sent what it lacks.
   */
  onWelcome(table: { readonly commands: number; readonly ended: boolean } | undefined): void {
    this.#connected = true;
    if (!table) {
      this.#started = false;
      this.#sent = 0;
      this.#endSent = false;
    } else {
      this.#started = true;
      this.#endSent = table.ended && this.#outcome !== null;
      this.#sent = Math.min(table.commands, this.#commands.length);
      if (table.commands > this.#commands.length) {
        this.#sendMessage({ ch: "game", kind: "rewind", table: this.#table, to: this.#commands.length });
      }
    }
    this.#flush();
    this.#report();
  }

  onDisconnected(): void {
    this.#connected = false;
    this.#started = false;
    this.#report();
  }

  /** A message from the room. */
  onMessage(message: ServerMessage): void {
    if (message.ch === "room" && message.kind === "roster") {
      this.#watchers = message.watchers;
      this.#report();
    } else if (message.ch === "game" && message.kind === "resend" && message.table === this.#table) {
      this.#resend();
    } else if (message.ch === "room" && message.kind === "refused" && message.reason === "out-of-order") {
      this.#resend();
    }
  }

  /** The game's log as it stands: for tests and a future "save this live game". */
  get commandCount(): number {
    return this.#commands.length;
  }

  /** The whole log, to the room's `resend` (and after an out-of-order refusal). */
  #resend(): void {
    if (!this.#connected) return;
    const ok = this.#sendMessage({
      ch: "game",
      kind: "log",
      table: this.#table,
      header: this.#header,
      commands: [...this.#commands],
      checksums: { ...this.#checksums },
    });
    if (!ok) return;
    this.#started = true;
    this.#sent = this.#commands.length;
    if (this.#outcome) this.#endSent = false;
    this.#flush();
  }

  /** Everything the room lacks, in order: the header, the commands since what it has, the end. */
  #flush(): void {
    if (!this.#connected) return;
    if (!this.#started) {
      if (!this.#sendMessage({ ch: "game", kind: "start", table: this.#table, header: this.#header })) return;
      this.#started = true;
    }
    if (this.#sent < this.#commands.length) {
      const from = this.#sent;
      const checksums: Record<string, string> = {};
      for (let count = from + 1; count <= this.#commands.length; count++) {
        const value = this.#checksums[String(count)];
        if (value !== undefined) checksums[String(count)] = value;
      }
      const ok = this.#sendMessage({
        ch: "game",
        kind: "commands",
        table: this.#table,
        from,
        commands: this.#commands.slice(from),
        ...(Object.keys(checksums).length > 0 ? { checksums } : {}),
      });
      if (!ok) return;
      this.#sent = this.#commands.length;
    }
    if (this.#outcome && !this.#endSent) {
      if (this.#sendMessage({ ch: "game", kind: "end", table: this.#table, outcome: this.#outcome })) {
        this.#endSent = true;
      }
    }
  }

  #sendMessage(body: DistributiveOmit<ClientMessage, "v">): boolean {
    // A refused send leaves the cursor where it was; the socket drops and the next welcome re-syncs.
    return this.#send({ v: ROOM_PROTOCOL_VERSION, ...body } as ClientMessage);
  }

  #report(): void {
    const status: LiveStatus = {
      watchUrl: this.#roomId ? watchLinkOf(this.#roomId, this.#watchBase) : null,
      watchers: this.#watchers,
      connected: this.#connected,
    };
    const last = this.#last;
    if (last.watchUrl === status.watchUrl && last.watchers === status.watchers && last.connected === status.connected) {
      return;
    }
    this.#last = status;
    this.#onStatus(status);
  }
}

type DistributiveOmit<T, K extends PropertyKey> = T extends unknown ? Omit<T, K> : never;
