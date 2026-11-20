/**
 * Live game rooms (`/room`, GitHub issue #876, docs/live-game-rooms.md): one Durable Object per room. Imported by the
 * client as `@mc/sync-worker/room-protocol`, so both sides share these shapes.
 *
 * A room is a gathering of **participants** around one or more **tables**. Each table is one game with its own
 * host-authoritative log: the device whose engine runs that table streams the log in, and the room fans it out. Built
 * now: one table, its host, and watchers. Shaped for what comes next (Quin, 2026-11-19): chat, then player seats that
 * propose commands to their table's host, then several tables in one room (Epic Multiplayer pods: one engine per group
 * and a pod coordinator, docs/epic-multiplayer-plan.md option B), whose shared state will travel as its own channel.
 *
 * Every message is an envelope `{ v, ch, kind, ... }` on a **channel**: `room` (membership, presence, lifecycle),
 * `game` (a table's log, every message names its `table`), `chat`. A side ignores a channel or kind it does not know,
 * and `hello`/`welcome` exchange capability lists, so a newer client and an older room (or the reverse) only lose the
 * features one of them lacks.
 *
 * The room never reads a game: headers, starting states, commands and outcomes are opaque JSON to it. It checks that
 * each batch continues its table's log and counts sizes. It keeps the log in frozen chunks of `ROOM_CHUNK_COMMANDS`
 * commands (one storage row per completed chunk, plus one for the header), with only the unfinished tail in memory; a
 * room that wakes from hibernation loads the chunks and asks the host for the tail with `resend { from }`.
 */

export const ROOM_PROTOCOL_VERSION = 1;

/** A room's id: 12 characters of the URL-safe base64 alphabet, 72 random bits (the same shape as a replay id). */
export const ROOM_ID_PATTERN = /^[A-Za-z0-9_-]{12}$/;
/** A secret handed out by the room (the host's, later a seat's): 32 characters, 192 random bits. Stored hashed. */
export const ROOM_TOKEN_PATTERN = /^[A-Za-z0-9_-]{32}$/;
/** A table's id within its room. */
export const TABLE_ID_PATTERN = /^[a-z0-9-]{1,16}$/;
/** The one table a room has until multi-table play. */
export const FIRST_TABLE = "t1";

/** Defaults when the matching var is missing or not a positive number. */
export const DEFAULT_MAX_ROOM_PARTICIPANTS = 25;
/** Cap on one message, except a `start` or `log`, which may be up to `MAX_LOG_BYTES`. */
export const DEFAULT_MAX_ROOM_MESSAGE_BYTES = 64 * 1024;
/** Commands in one stored chunk of a table's log: a row is written when a chunk fills, never rewritten. */
export const ROOM_CHUNK_COMMANDS = 20;
/** The whole command log of one table, in JSON bytes; past it the room refuses `too-large` and ends the table. */
export const DEFAULT_MAX_ROOM_LOG_BYTES = 8 * 1024 * 1024;
/** The room sends a joining watcher the log in parts of about this many bytes (a `log`, then `commands`). */
export const LOG_PART_BYTES = 512 * 1024;
/** After this many refusals (not counting `out-of-order`) the room closes the socket. */
export const MAX_ROOM_REFUSALS = 5;
/** A starting state and header (or the first part of a log): under the WebSocket's own 1 MiB message cap. */
export const MAX_LOG_BYTES = 1024 * 1024 - 1024;
export const DEFAULT_ROOMS_PER_IP_PER_DAY = 20;
/**
 * A display name's length cap, after trimming. A lobby room (`POST /room { lobby: true }`) requires one in `hello`; any
 * other room ignores `hello.name`, so watching works as it did.
 */
export const MAX_NAME_LENGTH = 24;
/** What `hello` may carry as a name (watch rooms ignore it); a lobby room cuts it to `MAX_NAME_LENGTH` code points. */
export const MAX_HELLO_NAME_CHARS = 32;
/** A room code's directory entry outlives the room's own expiry by this much, so the two alarms never race. */
export const ROOM_CODE_MARGIN_MS = 60 * 60 * 1000;
/** Seat and lobby messages per participant: a burst of this many, then 2 a second. */
export const LOBBY_MESSAGE_BURST = 10;
/** The most characters one chat line may have (`say`). */
export const MAX_CHAT_LENGTH = 280;
/** Chat rate per participant: one line a second on average, with a burst of this many. */
export const CHAT_BURST = 5;
/** Lines the room keeps in memory for a joiner (`backlog`). Chat is never stored. */
export const CHAT_BACKLOG_LINES = 50;
/** A lobby has at most this many seats (Marvel Champions has 1-4 heroes). */
export const MAX_LOBBY_SEATS = 4;
/** A seat's id: chosen by the host's client (for example `s1`..`s4`). */
export const SEAT_ID_PATTERN = /^[A-Za-z0-9_-]{1,16}$/;
/** A room code: 6 characters of the transfer alphabet (`CODE_ALPHABET`, no look-alikes). */
export const LOBBY_CODE_LENGTH = 6;
/** The largest `tableRules` object, in JSON characters. */
export const MAX_TABLE_RULES_CHARS = 16 * 1024;
/** A lobby holds at most this many mods. */
export const MAX_LOBBY_MODS = 64;
/** Most seat tokens a `hello` may present. */
export const MAX_HELLO_SEAT_TOKENS = 8;
/** A room closes this long after any host last sent anything. */
export const ROOM_IDLE_MS = 12 * 60 * 60 * 1000;
/** After every table has ended, the room stays open this long. */
export const ROOM_END_GRACE_MS = 5 * 60 * 1000;

/**
 * Capabilities a side may list in `hello` / `welcome`. `watch` is every room's; a room created with `lobby: true`
 * also advertises `chat` and `seats`. `tables` is not built.
 */
export type RoomCapability = "watch" | "chat" | "seats" | "tables";

/** `POST /room` answers 201 with this: the room, and the token that makes its holder the first table's host. */
export interface RoomCreated {
  readonly roomId: string;
  readonly hostToken: string;
  readonly table: string;
  /** Only for a room created with `{ lobby: true }`: the 6-character code that `GET /room/code/:code` resolves. */
  readonly code?: string;
}

/** The body of `POST /room`. Optional; a body that is not this (or is empty) creates a plain watch room. */
export interface RoomCreateRequest {
  readonly lobby?: boolean;
}

/** `GET /room/code/:code` answers 200 with this, or 404 `not-found` (an unknown, expired or closed code). */
export interface RoomCodeResolved {
  readonly roomId: string;
}

export type RoomErrorReason =
  | "disabled"
  | "origin"
  | "bad-request"
  | "rate-limited"
  | "turnstile"
  | "not-found"
  | "full"
  | "server";

export interface RoomError {
  readonly reason: RoomErrorReason;
  readonly error: string;
}

/** Opaque to the room: on the client, the replay file's header fields plus the starting state (`replay/live-*`). */
export type TableHeader = unknown;
/** One engine command, opaque to the room. */
export type TableCommand = unknown;
/** Replay checksums (every `CHECKSUM_EVERY` commands), keyed by command count. Opaque to the room. */
export type TableChecksums = Readonly<Record<string, string>>;

/**
 * How someone is in the room. `seat` (a player at a table who may propose) is reserved for multiplayer: a participant
 * who holds a lobby seat is still a `watcher` here; the seat's `holder` in the `lobby` message says who holds it.
 */
export type ParticipantRole = "host" | "seat" | "watcher";

/** The client build a participant runs. A seat requires it to equal the host's. */
export const DEVICE_PLATFORMS = ["web", "windows", "macos", "linux", "android", "ios"] as const;
export const DEVICE_FORMS = ["desktop", "tablet", "phone"] as const;

/** What a participant plays on, as two coarse values (no model, OS version or screen size). Shown in the roster. */
export interface RoomDevice {
  readonly platform: (typeof DEVICE_PLATFORMS)[number];
  readonly form: (typeof DEVICE_FORMS)[number];
}

/** A `device` from a `hello`, or undefined when it is missing or not exactly those two known values. */
export function cleanDevice(value: unknown): RoomDevice | undefined {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return undefined;
  const { platform, form } = value as Record<string, unknown>;
  const p = DEVICE_PLATFORMS.find((x) => x === platform);
  const f = DEVICE_FORMS.find((x) => x === form);
  return p && f ? { platform: p, form: f } : undefined;
}

export interface RoomBuild {
  readonly appVersion: string;
  readonly contentVersion: string;
}

export interface Participant {
  /** Stable for the connection's life; given by the room. A reconnect is a new id (seats follow the seat token). */
  readonly id: string;
  readonly role: ParticipantRole;
  /** The table a host or seat belongs to; absent for a watcher. */
  readonly table?: string;
  /** Trimmed, at most `MAX_NAME_LENGTH`; present for every participant of a lobby room, never in another room. */
  readonly name?: string;
  /** What the participant's `hello` said it runs, so a lobby can show a mismatch. */
  readonly build?: RoomBuild;
  /** From the participant's `hello`, in every room (watch rooms too); absent when it sent none or an unknown one. */
  readonly device?: RoomDevice;
}

/** How the game is played: `strict` is the game as written, `host` lets the host allow Undo, Manual adjust and so on. */
export type LobbyPlayMode = "strict" | "host";

export interface LobbyMod {
  readonly id: string;
  readonly version: string;
}

/** The host's room settings, shown to everyone. `appVersion` and `contentVersion` are the host's build, set by the room. */
export interface LobbySettings {
  readonly playMode: LobbyPlayMode;
  /** The game's `TableRules`, opaque to the room (at most `MAX_TABLE_RULES_CHARS` of JSON). */
  readonly tableRules: Readonly<Record<string, unknown>>;
  readonly mods: readonly LobbyMod[];
  /** May one participant hold more than one seat? */
  readonly multiSeat: boolean;
  readonly chat: boolean;
  readonly contentVersion: string;
  readonly appVersion: string;
}

/** What the host may change with `lobby-set`; `appVersion` and `contentVersion` are never taken from a client. */
export type LobbySettingsPatch = Partial<Omit<LobbySettings, "appVersion" | "contentVersion">>;

/** A seat as the host defines it. */
export interface LobbySeatSpec {
  readonly id: string;
  /** The hero or deck label, opaque to the room (at most 80 characters). */
  readonly label: string;
}

export interface LobbySeat extends LobbySeatSpec {
  /** The participant holding the seat. A holder whose id is not in the roster has disconnected and may rejoin by token. */
  readonly holder?: string;
  /** The holder's name, kept while they are disconnected. */
  readonly holderName?: string;
  /**
   * The connected holder runs a build that is not the host's (a seat restored by token after an update, or the host
   * changed build). The seat stays held; its holder may not act for it until the builds match again.
   * (A later multi-table step adds a `table` field here.)
   */
  readonly mismatch?: boolean;
  /** Participants who asked for the seat and await the host's answer. Memory only: a woken room starts with none. */
  readonly requested?: readonly string[];
}

/** The lobby: its code, the host's settings and the seats. Sent to everyone after each change, and to a joiner. */
export interface LobbyState {
  readonly code: string;
  readonly settings: LobbySettings;
  readonly seats: readonly LobbySeat[];
}

/** One line of chat as the room relays it. */
export interface ChatLine {
  /** The sender's participant id. */
  readonly from: string;
  readonly name?: string;
  readonly text: string;
  /** Milliseconds since the epoch, by the room's clock. */
  readonly at: number;
}

/** A table as the room reports it. */
export interface TableInfo {
  readonly id: string;
  readonly hostConnected: boolean;
  readonly commands: number;
  readonly ended: boolean;
  /** The room holds this table's header: false means it needs the host's `start` or `log`. */
  readonly hasHeader: boolean;
}

// ---------------------------------------------------------------------------------------------------------------
// Client to room

export type ClientMessage =
  /**
   * First message on a socket. A `token` the room issued makes the sender the host. In a lobby room `name` (trimmed,
   * at most `MAX_NAME_LENGTH`) is required and `build` is what a seat is checked against; `seatTokens` are seat tokens
   * from earlier `seat-token` messages, which put the sender back in those seats.
   */
  | {
      readonly v: 1;
      readonly ch: "room";
      readonly kind: "hello";
      readonly token?: string;
      readonly name?: string;
      readonly build?: RoomBuild;
      /** Optional and never refused: an unknown value is ignored. */
      readonly device?: RoomDevice;
      readonly seatTokens?: readonly string[];
      readonly caps: readonly RoomCapability[];
    }
  /** Host only, lobby rooms only: change settings and/or replace the seat list (holders of kept seat ids stay). */
  | {
      readonly v: 1;
      readonly ch: "room";
      readonly kind: "lobby-set";
      readonly settings?: LobbySettingsPatch;
      readonly seats?: readonly LobbySeatSpec[];
    }
  /** Ask for a seat (the host's own request is granted at once); needs the host's build and fewer seats than allowed. */
  | { readonly v: 1; readonly ch: "room"; readonly kind: "seat-request"; readonly seat: string }
  /** Give up a seat you hold, or withdraw a request. */
  | { readonly v: 1; readonly ch: "room"; readonly kind: "seat-release"; readonly seat: string }
  /** Host only: give a seat to a connected participant. The participant gets a private `seat-token`. */
  | {
      readonly v: 1;
      readonly ch: "room";
      readonly kind: "seat-assign";
      readonly seat: string;
      readonly participant: string;
    }
  /** Host only: turn down a request, or take the seat from its holder. */
  | {
      readonly v: 1;
      readonly ch: "room";
      readonly kind: "seat-deny";
      readonly seat: string;
      readonly participant: string;
    }
  | { readonly v: 1; readonly ch: "game"; readonly kind: "start"; readonly table: string; readonly header: TableHeader }
  /** The commands `from` .. `from + commands.length - 1`. A batch that does not continue the table's log is refused. */
  | {
      readonly v: 1;
      readonly ch: "game";
      readonly kind: "commands";
      readonly table: string;
      readonly from: number;
      readonly commands: readonly TableCommand[];
      readonly checksums?: TableChecksums;
    }
  /** A single-player Undo or Back out cut the log to its first `to` commands (never at a table with seats). */
  | { readonly v: 1; readonly ch: "game"; readonly kind: "rewind"; readonly table: string; readonly to: number }
  /**
   * The table's log from its start, answering `resend { from: 0 }`. It may carry only the first commands: the rest
   * follows as ordinary `commands` batches, each under the message cap.
   */
  | {
      readonly v: 1;
      readonly ch: "game";
      readonly kind: "log";
      readonly table: string;
      readonly header: TableHeader;
      readonly commands: readonly TableCommand[];
      readonly checksums?: TableChecksums;
    }
  | { readonly v: 1; readonly ch: "game"; readonly kind: "end"; readonly table: string; readonly outcome: unknown }
  // Reserved, not built: a seat's proposal for its table's host to judge.
  | {
      readonly v: 1;
      readonly ch: "game";
      readonly kind: "propose";
      readonly table: string;
      readonly command: TableCommand;
    }
  /** Lobby rooms with chat on: at most `MAX_CHAT_LENGTH` characters; 1 a second per participant, burst `CHAT_BURST`. */
  | { readonly v: 1; readonly ch: "chat"; readonly kind: "say"; readonly text: string };

// ---------------------------------------------------------------------------------------------------------------
// Room to client

export type ServerMessage =
  /** Answers `hello`: who you are, what the room supports, who is here and its tables. */
  | {
      readonly v: 1;
      readonly ch: "room";
      readonly kind: "welcome";
      readonly you: Participant;
      readonly caps: readonly RoomCapability[];
      readonly participants: readonly Participant[];
      readonly tables: readonly TableInfo[];
    }
  /** Someone joined, left or changed; `watchers` is the count of watchers, the number the presence card shows. */
  | {
      readonly v: 1;
      readonly ch: "room";
      readonly kind: "roster";
      readonly participants: readonly Participant[];
      readonly watchers: number;
    }
  | { readonly v: 1; readonly ch: "room"; readonly kind: "table"; readonly table: TableInfo }
  /** The room is closing. */
  | { readonly v: 1; readonly ch: "room"; readonly kind: "closed"; readonly reason: "ended" | "idle" | "disabled" }
  /** A message was refused; the socket stays open unless the room closes it (or the refusal is `name-required`). */
  | { readonly v: 1; readonly ch: "room"; readonly kind: "refused"; readonly reason: RefusalReason }
  /** Lobby rooms: everyone, after each change (and the joiner, after `welcome`). */
  | ({ readonly v: 1; readonly ch: "room"; readonly kind: "lobby" } & LobbyState)
  /** To the one participant given the seat, never broadcast: keep it and present it in `hello.seatTokens`. */
  | { readonly v: 1; readonly ch: "room"; readonly kind: "seat-token"; readonly seat: string; readonly token: string }
  /** To a participant whose pending request for `seat` the host turned down: stop asking (the request is gone). */
  | { readonly v: 1; readonly ch: "room"; readonly kind: "seat-denied"; readonly seat: string }
  /**
   * To a table's host: the room holds `from` commands of the table (its stored chunks after a wake, or the point a
   * refused batch did not line up with). Answer with ordinary `commands` batches from there, or, when `from` is 0,
   * with a `log` (the header and the first commands) and then `commands` batches.
   */
  | { readonly v: 1; readonly ch: "game"; readonly kind: "resend"; readonly table: string; readonly from: number }
  /**
   * To a watcher on join, and to everyone but the host when the host starts or replaces the table: the header and the
   * first commands (about `LOG_PART_BYTES`), followed by `commands` batches for the rest, then `end` when the table
   * ended. `outcome` is not used by the room now (`end` carries it).
   */
  | {
      readonly v: 1;
      readonly ch: "game";
      readonly kind: "log";
      readonly table: string;
      readonly header: TableHeader;
      readonly commands: readonly TableCommand[];
      readonly checksums: TableChecksums;
      readonly outcome?: unknown;
    }
  | {
      readonly v: 1;
      readonly ch: "game";
      readonly kind: "commands";
      readonly table: string;
      readonly from: number;
      readonly commands: readonly TableCommand[];
      readonly checksums?: TableChecksums;
    }
  | { readonly v: 1; readonly ch: "game"; readonly kind: "rewind"; readonly table: string; readonly to: number }
  | { readonly v: 1; readonly ch: "game"; readonly kind: "end"; readonly table: string; readonly outcome: unknown }
  // Reserved, not built: a proposal forwarded to the table's host.
  | {
      readonly v: 1;
      readonly ch: "game";
      readonly kind: "proposal";
      readonly table: string;
      readonly from: string;
      readonly command: TableCommand;
    }
  | ({ readonly v: 1; readonly ch: "chat"; readonly kind: "said" } & ChatLine)
  /** To a joiner of a lobby room with chat on, after `welcome`: the last `CHAT_BACKLOG_LINES` lines, oldest first. */
  | { readonly v: 1; readonly ch: "chat"; readonly kind: "backlog"; readonly lines: readonly ChatLine[] };

/**
 * Why a message was refused. `build-mismatch`: the participant's `build` is not the host's (a seat needs both versions
 * equal). `name-required`: a lobby room's `hello` had no usable name (the socket is closed). `rate-limited`: chat over
 * its limit. `multi-seat`: a second seat while the host has `multiSeat` off. Only `bad-message`, `too-large` and
 * `not-allowed` count toward the room closing a noisy socket.
 */
export type RefusalReason =
  | "bad-message"
  | "too-large"
  | "not-allowed"
  | "out-of-order"
  | "full"
  | "rate-limited"
  | "name-required"
  | "build-mismatch"
  | "multi-seat"
  | "seat-taken"
  | "no-such-seat"
  | "no-such-participant";

const CHANNELS = new Set(["room", "game", "chat"]);

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);
const isSeatId = (v: unknown): v is string => typeof v === "string" && SEAT_ID_PATTERN.test(v);
const shortString = (v: unknown, max: number): v is string => typeof v === "string" && v.length <= max;

function isBuild(v: unknown): v is RoomBuild {
  return isRecord(v) && shortString(v.appVersion, 64) && shortString(v.contentVersion, 64);
}

function isSeatSpecs(v: unknown): boolean {
  return (
    Array.isArray(v) &&
    v.length <= MAX_LOBBY_SEATS &&
    v.every((s) => isRecord(s) && isSeatId(s.id) && shortString(s.label, 80))
  );
}

function isSettingsPatch(v: unknown): boolean {
  if (!isRecord(v)) return false;
  if (v.playMode !== undefined && v.playMode !== "strict" && v.playMode !== "host") return false;
  if (v.multiSeat !== undefined && typeof v.multiSeat !== "boolean") return false;
  if (v.chat !== undefined && typeof v.chat !== "boolean") return false;
  if (v.tableRules !== undefined) {
    if (!isRecord(v.tableRules) || (JSON.stringify(v.tableRules)?.length ?? 0) > MAX_TABLE_RULES_CHARS) return false;
  }
  if (v.mods !== undefined) {
    if (!Array.isArray(v.mods) || v.mods.length > MAX_LOBBY_MODS) return false;
    if (!v.mods.every((m) => isRecord(m) && shortString(m.id, 64) && shortString(m.version, 32))) return false;
  }
  return true;
}

/**
 * Parses a client message, or null when it is not one this room can read (bad JSON, another protocol version, an
 * unknown channel or kind, or a field of the wrong shape). Sizes, roles and log order are the room's to check.
 */
export function parseClientMessage(text: string): ClientMessage | null {
  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch {
    return null;
  }
  if (typeof value !== "object" || value === null || Array.isArray(value)) return null;
  const m = value as Record<string, unknown>;
  if (m.v !== ROOM_PROTOCOL_VERSION || typeof m.ch !== "string" || !CHANNELS.has(m.ch)) return null;
  const isCount = (n: unknown): n is number => typeof n === "number" && Number.isInteger(n) && n >= 0;
  const isTable = (t: unknown): t is string => typeof t === "string" && TABLE_ID_PATTERN.test(t);
  const checksumsOk =
    m.checksums === undefined ||
    (typeof m.checksums === "object" && m.checksums !== null && !Array.isArray(m.checksums));
  const ok = (cond: boolean): ClientMessage | null => (cond ? (m as unknown as ClientMessage) : null);
  switch (`${m.ch}:${String(m.kind)}`) {
    case "room:hello":
      return ok(
        Array.isArray(m.caps) &&
          (m.token === undefined || typeof m.token === "string") &&
          (m.name === undefined || (typeof m.name === "string" && m.name.trim().length <= MAX_HELLO_NAME_CHARS)) &&
          (m.build === undefined || isBuild(m.build)) &&
          (m.seatTokens === undefined ||
            (Array.isArray(m.seatTokens) &&
              m.seatTokens.length <= MAX_HELLO_SEAT_TOKENS &&
              m.seatTokens.every((t) => typeof t === "string" && t.length <= 64))),
      );
    case "room:lobby-set":
      return ok(
        (m.settings === undefined || isSettingsPatch(m.settings)) &&
          (m.seats === undefined || isSeatSpecs(m.seats)) &&
          (m.settings !== undefined || m.seats !== undefined),
      );
    case "room:seat-request":
    case "room:seat-release":
      return ok(isSeatId(m.seat));
    case "room:seat-assign":
    case "room:seat-deny":
      return ok(isSeatId(m.seat) && typeof m.participant === "string" && m.participant.length <= 32);
    case "game:start":
      return ok(isTable(m.table) && "header" in m);
    case "game:commands":
      return ok(isTable(m.table) && isCount(m.from) && Array.isArray(m.commands) && checksumsOk);
    case "game:rewind":
      return ok(isTable(m.table) && isCount(m.to));
    case "game:log":
      return ok(isTable(m.table) && "header" in m && Array.isArray(m.commands) && checksumsOk);
    case "game:end":
      return ok(isTable(m.table));
    case "game:propose":
      return ok(isTable(m.table) && "command" in m);
    case "chat:say":
      return ok(typeof m.text === "string" && m.text.length <= MAX_CHAT_LENGTH * 4);
    default:
      return null;
  }
}
