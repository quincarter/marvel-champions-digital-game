/**
 * The host's side of a live game room (docs/live-game-rooms.md section 5), as plain logic with no socket in it: it
 * holds one game's log (header, commands, checksums), and turns what happens to the game (commands, rewinds, the end)
 * and what happens to the connection (welcome, drop, `resend`, roster) into the room-protocol messages to send.
 *
 * The host always keeps the whole log, so any `resend` is answered from here. What the room holds (its header, its
 * command count, whether the table ended) is tracked as `#room*`, and `#flush` brings it level in order: `start`, a
 * `rewind` when the room is ahead (the low-water mark of every cut since it last agreed), `commands` batches of at
 * most `BATCH_BYTES` (what piled up while disconnected goes out split to the cap), then `end`.
 * Checksums arrive with the command they follow (the engine worker takes one every `CHECKSUM_EVERY` commands, and on
 * the command that ends the game, with `replayChecksum` on the state it already holds) so no state crosses a port
 * per command; they are keyed by command count, as the room expects, with `"0"` the starting state.
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
  /** `replayChecksum` after `n` commands by `n` (`"0"` is the starting state), at the replay cadence. */
  readonly checksums?: Readonly<Record<string, string>>;
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

/** A `commands` batch stays well under the room's 64 KiB cap on a message. */
export const BATCH_BYTES = 48 * 1024;
/** A `log` (the header and the first commands) stays under the room's cap for one: just under 1 MiB. */
export const LOG_BYTES = 960 * 1024;

/** What the room says it holds of a table (`TableInfo`, less the id). */
export interface RoomTableState {
  readonly commands: number;
  readonly ended: boolean;
  readonly hasHeader: boolean;
}

export interface LivePublisherOptions {
  readonly game: LiveGame;
  /** Puts a message on the socket; false when it could not be sent (nothing went out). */
  readonly send: (message: ClientMessage) => boolean;
  readonly onStatus: (status: LiveStatus) => void;
  /** The web version's address the watch link hangs off (see `watchLinkOf`). */
  readonly watchBase: string;
  readonly table?: string;
  /** A command did not continue this log: ask the engine worker for the game again (`{kind:"resync"}`). */
  readonly onResync?: () => void;
  /** The room refused the log as too large (past its cap): this game is no longer streamed. */
  readonly onGiveUp?: () => void;
}

const sizeOf = (value: unknown): number => JSON.stringify(value).length;
const sameCommand = (a: unknown, b: unknown): boolean => a === b || JSON.stringify(a) === JSON.stringify(b);

type DistributiveOmit<T, K extends PropertyKey> = T extends unknown ? Omit<T, K> : never;

export class LivePublisher {
  readonly #send: (message: ClientMessage) => boolean;
  readonly #onStatus: (status: LiveStatus) => void;
  readonly #watchBase: string;
  readonly #table: string;
  readonly #onResync: (() => void) | undefined;
  readonly #onGiveUp: (() => void) | undefined;
  #header: LiveTableHeader;
  #commands: Command[];
  /** Checksums by command count (a string key, as the room has them). */
  #checksums: Record<string, string>;
  #roomId: string | null = null;
  #connected = false;
  /** What the room holds, as far as this side knows: set from the welcome, advanced by what is sent. */
  #roomHeader = false;
  #roomCount = 0;
  #roomEnded = false;
  /** The lowest count any cut since the room last agreed went to (Infinity: none). A cut made offline lives here. */
  #lowWater = Number.POSITIVE_INFINITY;
  #outcome: GameOutcome | null;
  #watchers = 0;
  #gaveUp = false;
  #last: LiveStatus = NO_LIVE_STATUS;

  constructor(options: LivePublisherOptions) {
    this.#send = options.send;
    this.#onStatus = options.onStatus;
    this.#watchBase = options.watchBase;
    this.#table = options.table ?? FIRST_TABLE;
    this.#onResync = options.onResync;
    this.#onGiveUp = options.onGiveUp;
    this.#header = headerOf(options.game);
    this.#commands = [...options.game.commands];
    this.#checksums = { ...options.game.checksums };
    this.#outcome = options.game.outcome ?? null;
  }

  /** The room was created: from now on the status carries the watch link. */
  roomOpened(roomId: string): void {
    this.#roomId = roomId;
    this.#report();
  }

  /** The command number `count` (so `count` commands now) was applied, with its checksum when one is due. */
  command(command: Command, count: number, checksum?: string, outcome?: GameOutcome | null): void {
    if (count !== this.#commands.length + 1) {
      // A gap (or a repeat): this log is not the engine's. The engine worker answers with the whole game.
      this.#onResync?.();
      return;
    }
    this.#commands.push(command);
    if (checksum !== undefined) this.#checksums[String(count)] = checksum;
    if (outcome) this.#outcome = outcome;
    this.#flush();
  }

  /** An Undo or Back out cut the log to its first `to` commands. */
  rewind(to: number): void {
    if (to < 0 || to > this.#commands.length) {
      this.#onResync?.();
      return;
    }
    this.#commands.length = to;
    for (const key of Object.keys(this.#checksums)) if (Number(key) > to) delete this.#checksums[key];
    this.#outcome = null;
    this.#lowWater = Math.min(this.#lowWater, to);
    this.#flush();
  }

  /**
   * The engine worker posted the game again (a resume, a resync, the setting coming back on) and it is the game this
   * publisher already streams: take its log, cut the room back to where the two logs part, and carry on from there.
   */
  replaceGame(game: LiveGame): void {
    let common = 0;
    const limit = Math.min(this.#commands.length, game.commands.length);
    while (common < limit && sameCommand(this.#commands[common], game.commands[common])) common++;
    this.#header = headerOf(game);
    this.#commands = [...game.commands];
    this.#checksums = { ...game.checksums };
    this.#outcome = game.outcome ?? null;
    // The room may hold what the old log had past the point the logs parted.
    this.#lowWater = Math.min(this.#lowWater, common);
    this.#flush();
  }

  /**
   * The socket is welcomed. `table` is what the room says it holds of this table (absent, or no header: nothing, so
   * `start` and the whole log go out).
   */
  onWelcome(table: RoomTableState | undefined): void {
    this.#connected = true;
    this.#roomHeader = table?.hasHeader ?? false;
    this.#roomCount = this.#roomHeader ? (table?.commands ?? 0) : 0;
    this.#roomEnded = this.#roomHeader ? (table?.ended ?? false) : false;
    this.#flush();
    this.#report();
  }

  onDisconnected(): void {
    this.#connected = false;
    this.#report();
  }

  /** The game is being left (a new game, the setting off): tell the room this table is over, without an outcome. */
  abandon(): void {
    if (!this.#connected || this.#gaveUp || this.#outcome || this.#roomEnded) return;
    this.#sendMessage({ ch: "game", kind: "end", table: this.#table, outcome: null });
  }

  /** A message from the room. */
  onMessage(message: ServerMessage): void {
    if (message.ch === "room" && message.kind === "roster") {
      this.#watchers = message.watchers;
      this.#report();
    } else if (message.ch === "game" && message.kind === "resend" && message.table === this.#table) {
      this.#resend(message.from);
    } else if (message.ch === "room" && message.kind === "refused" && message.reason === "too-large") {
      // The log is past what the room keeps (or one message was too big and cannot be made smaller): stop streaming.
      this.#gaveUp = true;
      this.#onGiveUp?.();
    }
  }

  /** The game's log as it stands: for tests and a future "save this live game". */
  get commandCount(): number {
    return this.#commands.length;
  }

  get gaveUp(): boolean {
    return this.#gaveUp;
  }

  /**
   * The room asks for the log from `from` (the commands it holds): from 0 is a `log` (the header and a prefix of the
   * commands, to the cap) and the rest follows as batches; from above 0 is just the batches from there.
   */
  #resend(from: number): void {
    if (!this.#connected || this.#gaveUp) return;
    if (from === 0) {
      // A brand-new room asks right after the welcome, which `onWelcome` already answered with `start`.
      if (this.#roomHeader && this.#roomCount === 0) return;
      const end = this.#take(0, Math.max(0, LOG_BYTES - sizeOf(this.#header)), false);
      const ok = this.#sendMessage({
        ch: "game",
        kind: "log",
        table: this.#table,
        header: this.#header,
        commands: this.#commands.slice(0, end),
        checksums: this.#checksumsIn(0, end),
      });
      if (!ok) return;
      this.#roomHeader = true;
      this.#roomCount = end;
      // The room's `log` carries no outcome: the table is open until `end` goes out again.
      this.#roomEnded = false;
      this.#lowWater = Number.POSITIVE_INFINITY;
    } else {
      this.#roomHeader = true;
      this.#roomCount = from;
    }
    this.#flush();
  }

  /** The index after the last command from `from` that fits in `budget` bytes; `atLeastOne` keeps the stream moving. */
  #take(from: number, budget: number, atLeastOne: boolean): number {
    let used = 0;
    let n = from;
    while (n < this.#commands.length) {
      const size = sizeOf(this.#commands[n]) + 1;
      if (used + size > budget && !(atLeastOne && n === from)) break;
      used += size;
      n++;
    }
    return n;
  }

  /** The checksums kept for the positions `from` .. `to`, with the starting state's (`"0"`) in the first batch. */
  #checksumsIn(from: number, to: number): Record<string, string> {
    const out: Record<string, string> = {};
    for (let count = from === 0 ? 0 : from + 1; count <= to; count++) {
      const value = this.#checksums[String(count)];
      if (value !== undefined) out[String(count)] = value;
    }
    return out;
  }

  /** Brings the room level with the log, in order: header, cut, commands, end. */
  #flush(): void {
    if (!this.#connected || this.#gaveUp) return;
    if (!this.#roomHeader) {
      if (!this.#sendMessage({ ch: "game", kind: "start", table: this.#table, header: this.#header })) return;
      this.#roomHeader = true;
      this.#roomCount = 0;
      this.#roomEnded = false;
      this.#lowWater = Number.POSITIVE_INFINITY;
    }
    // The room is ahead of this log (a cut made while it was away, or since), or still shows an ended table that is not.
    const target = Math.min(this.#lowWater, this.#commands.length);
    if (this.#roomCount > target || (this.#roomEnded && !this.#outcome)) {
      const to = Math.min(this.#roomCount, target);
      if (!this.#sendMessage({ ch: "game", kind: "rewind", table: this.#table, to })) return;
      this.#roomCount = to;
      this.#roomEnded = false;
    }
    this.#lowWater = Number.POSITIVE_INFINITY;
    while (this.#roomCount < this.#commands.length) {
      const from = this.#roomCount;
      const to = this.#take(from, BATCH_BYTES, true);
      const checksums = this.#checksumsIn(from, to);
      const ok = this.#sendMessage({
        ch: "game",
        kind: "commands",
        table: this.#table,
        from,
        commands: this.#commands.slice(from, to),
        ...(Object.keys(checksums).length > 0 ? { checksums } : {}),
      });
      if (!ok) return;
      this.#roomCount = to;
    }
    if (this.#outcome && !this.#roomEnded) {
      if (this.#sendMessage({ ch: "game", kind: "end", table: this.#table, outcome: this.#outcome })) {
        this.#roomEnded = true;
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
