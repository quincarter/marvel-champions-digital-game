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
 * each batch continues its table's log, counts sizes, and keeps logs in memory only (a woken room with an empty log asks
 * the table's host to send it again), so it writes no storage row per command.
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
/** A starting state and header, or a full-log resend: under the WebSocket's own 1 MiB message cap. */
export const MAX_LOG_BYTES = 1024 * 1024 - 1024;
export const DEFAULT_ROOMS_PER_IP_PER_DAY = 20;
/** A display name's length cap (names arrive with chat; until then a participant may be nameless). */
export const MAX_NAME_LENGTH = 32;
/** A room closes this long after any host last sent anything. */
export const ROOM_IDLE_MS = 12 * 60 * 60 * 1000;
/** After every table has ended, the room stays open this long. */
export const ROOM_END_GRACE_MS = 5 * 60 * 1000;

/** Capabilities a side may list in `hello` / `welcome`. Only `watch` is built. */
export type RoomCapability = "watch" | "chat" | "seats" | "tables";

/** `POST /room` answers 201 with this: the room, and the token that makes its holder the first table's host. */
export interface RoomCreated {
  readonly roomId: string;
  readonly hostToken: string;
  readonly table: string;
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

/** How someone is in the room. `seat` (a player at a table who may propose) is reserved for multiplayer. */
export type ParticipantRole = "host" | "seat" | "watcher";

export interface Participant {
  /** Stable for the connection's life; given by the room. */
  readonly id: string;
  readonly role: ParticipantRole;
  /** The table a host or seat belongs to; absent for a watcher. */
  readonly table?: string;
  readonly name?: string;
}

/** A table as the room reports it. */
export interface TableInfo {
  readonly id: string;
  readonly hostConnected: boolean;
  readonly commands: number;
  readonly ended: boolean;
}

// ---------------------------------------------------------------------------------------------------------------
// Client to room

export type ClientMessage =
  /** First message on a socket. A `token` the room issued makes the sender that token's host (later, seat). */
  | {
      readonly v: 1;
      readonly ch: "room";
      readonly kind: "hello";
      readonly token?: string;
      readonly name?: string;
      readonly caps: readonly RoomCapability[];
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
  /** The table's whole log, answering `resend`. */
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
  // Reserved, not built: a seat's proposal for its table's host to judge, and chat.
  | {
      readonly v: 1;
      readonly ch: "game";
      readonly kind: "propose";
      readonly table: string;
      readonly command: TableCommand;
    }
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
  /** A message was refused; the socket stays open unless the room closes it. */
  | {
      readonly v: 1;
      readonly ch: "room";
      readonly kind: "refused";
      readonly reason: "bad-message" | "too-large" | "not-allowed" | "out-of-order" | "full";
    }
  /** To a table's host: the room has no log for the table (it woke empty, or a batch did not line up). Send `log`. */
  | { readonly v: 1; readonly ch: "game"; readonly kind: "resend"; readonly table: string }
  /** On join (one per table that has started) and after a resend: the table's whole log so far. */
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
  // Reserved, not built: a proposal forwarded to the table's host, and chat.
  | {
      readonly v: 1;
      readonly ch: "game";
      readonly kind: "proposal";
      readonly table: string;
      readonly from: string;
      readonly command: TableCommand;
    }
  | {
      readonly v: 1;
      readonly ch: "chat";
      readonly kind: "said";
      readonly from: string;
      readonly name?: string;
      readonly text: string;
      readonly at: number;
    };

const CHANNELS = new Set(["room", "game", "chat"]);

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
          (m.name === undefined || (typeof m.name === "string" && m.name.length <= MAX_NAME_LENGTH)),
      );
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
      return ok(typeof m.text === "string");
    default:
      return null;
  }
}
