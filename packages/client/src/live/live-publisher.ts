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
  /** The game counts for nothing (a room with Cheats on): a watcher's record of it is adjusted too. Absent otherwise. */
  readonly adjusted?: true;
}

/** What the engine worker knows of a game when the live stream starts (or the setting is switched on mid-game). */
export interface LiveGame {
  readonly writer: ReplayWriter;
  /** Already free of the packs' data and deck names (`live-game.ts`). */
  readonly config: SessionConfig;
  readonly packs?: readonly ReplayPackRef[];
  readonly createdAt: number;
  readonly initialState: StateWithoutPool;
  /**
   * The game counts for nothing: it was started with room Cheats on (`SessionConfig.roomCheats`) or the session has
   * been adjusted since (`EngineSessionCore` `#adjusted`). Carried to the header, and sticky once set (#909).
   */
  readonly adjusted?: true;
  /** The commands so far: none for a new game, the log for a resumed one. */
  readonly commands: readonly Command[];
  readonly outcome?: GameOutcome | null;
  /** `replayChecksum` after `n` commands by `n` (`"0"` is the starting state), at the replay cadence. */
  readonly checksums?: Readonly<Record<string, string>>;
  /** The lobby revision the game was built from: the first `start` carries it, and the room refuses a stale one. */
  readonly lobbyRev?: number;
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
    ...(game.adjusted ? { adjusted: true as const } : {}),
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
  /** The admission id of the game the table's header belongs to (absent: none recorded, or an older room). */
  readonly gid?: string;
  /** The room's latest checksum and its command count (null: none; undefined: the room does not say, so it is trusted). */
  readonly checkpoint?: { readonly count: number; readonly sum: string } | null;
  /** The room holds a log it has not stored: its `gid` is the durable admission, and its count and checkpoint claim nothing. */
  readonly dirty?: boolean;
  /** The room holds this game as adjusted (its sticky latch). Absent: it does not, or an older room does not say. */
  readonly adjusted?: boolean;
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
  /** The room refused the first `start` because the lobby had changed since the game was built (`lobby-changed`). */
  readonly onLobbyChanged?: () => void;
  /** The room confirmed it admitted this game (`started`): the host persists the admission id to resume it later. */
  readonly onAdmitted?: (gid: string) => void;
  /** The admission id: derive it from the game's durable identity so a resumed host recomputes it (`gidOfGame`). */
  readonly gid?: string;
}

/** A `start` the room could not save is sent again this many times, from `START_RETRY_MS` doubling each time. */
const START_RETRIES = 5;
const START_RETRY_MS = 500;

const encoder = new TextEncoder();
/** UTF-8 bytes, as the room measures a frame (`.length` counts UTF-16 units and undercounts non-ASCII text). */
const sizeOf = (value: unknown): number => encoder.encode(JSON.stringify(value)).byteLength;
/** Room for a message's envelope (version, channel, kind, table, from) around its commands and checksums. */
const ENVELOPE_BYTES = 1024;
const sameCommand = (a: unknown, b: unknown): boolean => a === b || JSON.stringify(a) === JSON.stringify(b);

const isAdjust = (command: Command): boolean => command.type === "adjust";

type DistributiveOmit<T, K extends PropertyKey> = T extends unknown ? Omit<T, K> : never;

/**
 * A game's admission id from its own durable identity (save key and creation time, both fixed before the first start
 * and kept by a resumed game), so a host that reloads before any record write landed still derives the same id.
 * 53-bit cyrb53-style hash: an identity, not a secret.
 */
export function gidOfGame(gameKey: string, createdAt: number): string {
  const text = `${gameKey}|${createdAt}`;
  let h1 = 0xdeadbeef;
  let h2 = 0x41c6ce57;
  for (let i = 0; i < text.length; i++) {
    const c = text.charCodeAt(i);
    h1 = Math.imul(h1 ^ c, 2654435761);
    h2 = Math.imul(h2 ^ c, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return `g-${(h1 >>> 0).toString(16).padStart(8, "0")}${(h2 >>> 0).toString(16).padStart(8, "0")}`;
}

const randomGid = (): string =>
  globalThis.crypto?.randomUUID?.() ?? `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 12)}`;

export class LivePublisher {
  readonly #send: (message: ClientMessage) => boolean;
  readonly #onStatus: (status: LiveStatus) => void;
  readonly #watchBase: string;
  readonly #table: string;
  readonly #onResync: (() => void) | undefined;
  readonly #onGiveUp: (() => void) | undefined;
  readonly #onLobbyChanged: (() => void) | undefined;
  readonly #onAdmitted: ((gid: string) => void) | undefined;
  /**
   * Sent with every message that would install this game's header (`start`, a `log` replacement) until the room
   * answers `started`: a socket accepting a frame does not mean the room applied it, so a retry after a drop must
   * still be refused when the lobby moved on. Cleared by the ack only.
   */
  #lobbyRev: number | undefined;
  /** Retries of a `start` / `log` the room could not save (`not-saved`), and the timer of the next one. */
  #saveRetries = 0;
  #retryTimer: ReturnType<typeof setTimeout> | undefined;
  /**
   * This game's admission id, sent with `start` / `log` while the lobby revision is unconfirmed. The room stores it
   * with the header, so a retry after a lost `started` is recognised as the game it already admitted.
   */
  #gid: string = randomGid();
  /** A resumed game in a lobby room: it may join a table that holds its header, but never installs one. */
  #joinOnly = false;
  /** The room's durable admission is this game's own and only its log is unstored: resending the log is allowed. */
  #repair = false;
  #header: LiveTableHeader;
  /** The game is adjusted (header flag, a Manual adjust in the log, or an acknowledged Undo past a reveal). Never cleared. */
  #adjusted: boolean;
  /** The room has not been told of an adjustment made since its last frame: the next flush sends it. */
  #adjustedUnsent = false;
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
  /** The room's table is not this game's: replace it with `start` (after reopening it when it shows ended). */
  #replaceTable = false;
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
    this.#onLobbyChanged = options.onLobbyChanged;
    this.#onAdmitted = options.onAdmitted;
    if (options.gid) this.#gid = options.gid;
    this.#lobbyRev = options.game.lobbyRev;
    this.#header = headerOf(options.game);
    this.#adjusted = options.game.adjusted === true || options.game.commands.some(isAdjust);
    this.#commands = [...options.game.commands];
    this.#checksums = { ...options.game.checksums };
    this.#outcome = options.game.outcome ?? null;
  }

  /** The admission id the room recorded for this game, kept from before a reload (a resumed host's own record). */
  adoptGid(gid: string): void {
    this.#gid = gid;
  }

  /** This game was resumed into a lobby room: it never installs a header, only continues an admitted table. */
  requireAdmittedRoom(): void {
    this.#joinOnly = true;
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
    if (isAdjust(command)) this.#markAdjusted();
    if (checksum !== undefined) this.#checksums[String(count)] = checksum;
    if (outcome) this.#outcome = outcome;
    this.#flush();
  }

  /**
   * An Undo or Back out cut the log to its first `to` commands. `adjusted`: the cut was an Undo past a reveal that the
   * host acknowledged, so the game now counts for nothing (#909); the room is told with the cut.
   */
  rewind(to: number, adjusted = false): void {
    if (to < 0 || to > this.#commands.length) {
      this.#onResync?.();
      return;
    }
    if (adjusted) this.#markAdjusted();
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
    if (game.adjusted === true || game.commands.some(isAdjust)) this.#markAdjusted();
    else if (this.#adjusted) this.#header = { ...this.#header, adjusted: true };
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
    this.#repair = false;
    this.#roomHeader = table?.hasHeader ?? false;
    this.#roomCount = this.#roomHeader ? (table?.commands ?? 0) : 0;
    this.#roomEnded = this.#roomHeader ? (table?.ended ?? false) : false;
    if (this.#roomHeader && this.#lobbyRev !== undefined) {
      if (table?.gid === this.#gid) {
        // The room admitted this very game and only its `started` was lost: nothing to resend, the revision is spent.
        // The welcome is proof of admission like `started`, so the id is persisted the same way.
        this.#lobbyRev = undefined;
        this.#onAdmitted?.(this.#gid);
      } else {
        // A header that is not known to be this game's (it may be the last game's): the start goes out again with
        // its revision and the room settles it.
        this.#roomHeader = false;
        this.#replaceTable = true;
      }
    }
    // A table that names another game is never ours, whatever its checksum says (two rematches can share setup, seed
    // and commands, notably at checkpoint 0): replace it (a lobby game gives up instead, in #mayInstall). A table with
    // no gid is legacy room data from before admission ids, and falls back to the checkpoint comparison below.
    if (this.#roomHeader && table?.gid !== undefined && table.gid !== this.#gid) {
      this.#roomHeader = false;
      this.#replaceTable = true;
    }
    // The room holds this very admission but not the log it has since been given (a failed write): the log goes again.
    // Nothing is installed under a new admission, so a resumed lobby game may do it; another game's gid is never ours.
    if (this.#roomHeader && table?.dirty === true && table.gid === this.#gid) {
      this.#roomHeader = false;
      this.#replaceTable = true;
      this.#repair = true;
    }
    // The room holds this very game but not that it is adjusted (its latch write failed and it restarted, or it is an
    // older room): the host's own game knows, so it says so again with a rewind to the count the room holds (below).
    if (this.#roomHeader && this.#adjusted && table?.gid !== undefined && table.gid === this.#gid && !table.adjusted)
      this.#adjustedUnsent = true;
    // The room's command count does not say it holds this game: a host resumed from a save can meet a room with the
    // same number of different commands, and a rewind the socket took but the room never received leaves the room's old
    // prefix behind a count the host has since reached again. So every welcome checks: the room's latest checksum is compared with ours at the same count; with no
    // proof the table is replaced from our log, and commands past the proven count are cut back and resent.
    // The admitted game before its first command has a header but no checksum yet (checkpoint null, no commands): its
    // gid is the proof, and only this host's own persisted gid can match it.
    const admittedEmpty =
      this.#roomHeader && table?.gid === this.#gid && table.checkpoint === null && this.#roomCount === 0;
    if (this.#roomHeader && !admittedEmpty && table?.checkpoint !== undefined) {
      const proof = table.checkpoint;
      if (!proof || this.#checksums[String(proof.count)] !== proof.sum) {
        this.#roomHeader = false;
        this.#replaceTable = true;
      } else if (this.#roomCount > proof.count) {
        this.#lowWater = Math.min(this.#lowWater, proof.count);
      }
    }
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
    } else if (message.ch === "game" && message.kind === "started" && message.table === this.#table) {
      if (message.gid === undefined || message.gid === this.#gid) {
        this.#lobbyRev = undefined;
        this.#saveRetries = 0;
        clearTimeout(this.#retryTimer);
        this.#onAdmitted?.(this.#gid);
      }
    } else if (message.ch === "game" && message.kind === "resend" && message.table === this.#table) {
      this.#resend(message.from);
    } else if (
      message.ch === "room" &&
      message.kind === "refused" &&
      message.reason === "lobby-changed" &&
      this.#lobbyRev !== undefined
    ) {
      // The game this publisher streams was built from an older lobby: it never became the room's table.
      this.#gaveUp = true;
      this.#onLobbyChanged?.();
    } else if (
      message.ch === "room" &&
      message.kind === "refused" &&
      message.reason === "not-saved" &&
      this.#lobbyRev !== undefined
    ) {
      // The room could not store the game's header (or the log): until it answers `started` the game is not the room's
      // table, so the start goes out again after a pause, and the host is told when it never lands.
      this.#retryStart();
    } else if (message.ch === "room" && message.kind === "refused" && message.reason === "too-large") {
      // The log is past what the room keeps (or one message was too big and cannot be made smaller): stop streaming.
      this.#gaveUp = true;
      this.#onGiveUp?.();
    }
  }

  /** The game counts for nothing (#909): for tests. */
  get adjusted(): boolean {
    return this.#adjusted;
  }

  #retryStart(): void {
    if (this.#gaveUp || this.#retryTimer !== undefined) return;
    if (this.#saveRetries >= START_RETRIES) {
      // Never silent: the same signal as a log the room will not keep, so the host sees the game is not being shared.
      this.#gaveUp = true;
      this.#onGiveUp?.();
      return;
    }
    const wait = START_RETRY_MS * 2 ** this.#saveRetries;
    this.#saveRetries += 1;
    this.#retryTimer = setTimeout(() => {
      this.#retryTimer = undefined;
      if (this.#gaveUp || this.#lobbyRev === undefined) return;
      this.#roomHeader = false;
      this.#replaceTable = true;
      this.#flush();
    }, wait);
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
      // Nothing to send but a header the room already holds.
      if (this.#roomHeader && this.#commands.length === 0) return;
      if (!this.#mayInstall()) return;
      const end = this.#take(0, Math.max(0, LOG_BYTES - ENVELOPE_BYTES - sizeOf(this.#header)), false);
      const ok = this.#sendMessage({
        ch: "game",
        kind: "log",
        table: this.#table,
        header: this.#header,
        commands: this.#commands.slice(0, end),
        checksums: this.#checksumsIn(0, end),
        // The gid always travels: after admission it marks a same-game repair, so the room keeps the identity.
        gid: this.#gid,
        ...(this.#lobbyRev !== undefined ? { lobbyRev: this.#lobbyRev } : {}),
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

  /** A resumed lobby game is never the one to put a header on a table: it gives up instead. */
  #mayInstall(): boolean {
    if (!this.#joinOnly || this.#repair) return true;
    this.#gaveUp = true;
    this.#onGiveUp?.();
    return false;
  }

  /** The index after the last command from `from` that fits in `budget` bytes; `atLeastOne` keeps the stream moving. */
  #take(from: number, budget: number, atLeastOne: boolean): number {
    let used = 0;
    let n = from;
    while (n < this.#commands.length) {
      const sum = this.#checksums[String(n === 0 ? 0 : n + 1)];
      // The command, its separator, and the checksum entry that travels with it (`"count":"sum",`).
      const size = sizeOf(this.#commands[n]) + 1 + (sum === undefined ? 0 : sizeOf(sum) + String(n + 1).length + 4);
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
      if (!this.#mayInstall()) return;
      // The room refuses a `start` on an ended table: a same-count rewind reopens it first. Not for a game whose
      // lobby revision is unconfirmed: the rewind carries none, and a lobby room's `start` reopens the table itself.
      if (this.#replaceTable && this.#roomEnded && this.#lobbyRev === undefined) {
        if (!this.#sendMessage({ ch: "game", kind: "rewind", table: this.#table, to: this.#roomCount })) return;
        this.#roomEnded = false;
      }
      const lobbyRev = this.#lobbyRev;
      // Saved before the first `start` goes out, so a crash before any proof still leaves the record able to
      // recognize the table the room may have admitted.
      this.#onAdmitted?.(this.#gid);
      const started = this.#sendMessage({
        ch: "game",
        kind: "start",
        table: this.#table,
        header: this.#header,
        gid: this.#gid,
        ...(lobbyRev !== undefined ? { lobbyRev } : {}),
      });
      if (!started) return;
      this.#roomHeader = true;
      this.#roomCount = 0;
      this.#roomEnded = false;
      this.#replaceTable = false;
      this.#lowWater = Number.POSITIVE_INFINITY;
    }
    // The room is ahead of this log (a cut made while it was away, or since), or still shows an ended table that is not.
    const target = Math.min(this.#lowWater, this.#commands.length);
    // A rewind also goes when the game was just adjusted and the room is not told: a cut to the count it holds.
    if (this.#roomCount > target || (this.#roomEnded && !this.#outcome) || this.#adjustedUnsent) {
      const to = Math.min(this.#roomCount, target);
      const cut = this.#sendMessage({
        ch: "game",
        kind: "rewind",
        table: this.#table,
        to,
        ...(this.#adjusted ? { adjusted: true as const } : {}),
      });
      if (!cut) return;
      this.#roomCount = to;
      this.#roomEnded = false;
      this.#adjustedUnsent = false;
    }
    this.#lowWater = Number.POSITIVE_INFINITY;
    while (this.#roomCount < this.#commands.length) {
      const from = this.#roomCount;
      const to = this.#take(from, BATCH_BYTES - ENVELOPE_BYTES, true);
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
      const ended = this.#sendMessage({
        ch: "game",
        kind: "end",
        table: this.#table,
        outcome: this.#outcome,
        ...(this.#adjusted ? { adjusted: true as const } : {}),
      });
      if (ended) {
        this.#roomEnded = true;
      }
    }
  }

  /** Remembers the game is adjusted: the header a later `start` / `log` carries says so, and the room is told. */
  #markAdjusted(): void {
    if (!this.#adjusted) this.#adjustedUnsent = true;
    this.#adjusted = true;
    this.#header = { ...this.#header, adjusted: true };
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
