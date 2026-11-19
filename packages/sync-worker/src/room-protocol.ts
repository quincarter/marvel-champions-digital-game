/**
 * Live game rooms (`/room`, GitHub issue #876, docs/live-game-rooms.md): one Durable Object per live game. The host (the
 * device whose engine runs the game) streams the game's log in over a WebSocket and the room fans it out to watchers.
 * Imported by the client as `@mc/sync-worker/room-protocol`, so both sides share these shapes.
 *
 * The room never reads a game: the header, the starting state and the commands are opaque JSON to it. It only checks
 * that each batch continues its log (`from`), counts sizes, and keeps the log in memory (a woken room with an empty log
 * asks the host to send it again, so the room writes no storage row per command).
 *
 * Multiplayer (player seats that propose commands, judged by the host) is reserved here but not built yet.
 */

export const ROOM_PROTOCOL_VERSION = 1;

/** A room's id: 12 characters of the URL-safe base64 alphabet, 72 random bits (the same shape as a replay id). */
export const ROOM_ID_LENGTH = 12;
export const ROOM_ID_PATTERN = /^[A-Za-z0-9_-]{12}$/;
/** The host's secret: 32 characters of the same alphabet, 192 random bits. The room keeps only its SHA-256. */
export const HOST_TOKEN_PATTERN = /^[A-Za-z0-9_-]{32}$/;

/** Defaults when the matching var is missing or not a positive number. */
export const DEFAULT_MAX_ROOM_WATCHERS = 25;
/** Cap on one message after the first; the first `start` may be up to `MAX_START_BYTES`. */
export const DEFAULT_MAX_ROOM_MESSAGE_BYTES = 64 * 1024;
/** The starting state and header, and a full-log resend: under the WebSocket's own 1 MiB message cap. */
export const MAX_START_BYTES = 1024 * 1024 - 1024;
/** New rooms a day per IP. */
export const DEFAULT_ROOMS_PER_IP_PER_DAY = 20;
/** A room closes this long after its host last sent anything. */
export const ROOM_IDLE_MS = 12 * 60 * 60 * 1000;
/** After `end`, watchers keep the room this long before it closes them. */
export const ROOM_END_GRACE_MS = 5 * 60 * 1000;

/** `POST /room` answers 201 with this. */
export interface RoomCreated {
  readonly roomId: string;
  readonly hostToken: string;
}

export type RoomErrorReason =
  | "disabled"
  | "origin"
  | "bad-request"
  | "rate-limited"
  | "turnstile"
  | "not-found"
  | "host-taken"
  | "server";

export interface RoomError {
  readonly reason: RoomErrorReason;
  readonly error: string;
}

/**
 * What the host says about the game once: opaque to the room. On the client it is the replay file's header fields and
 * the starting state (`replay/live-*`), so a watcher builds the same `ReplayFile` a shared replay would be.
 */
export type RoomHeader = unknown;
/** One engine command, opaque to the room. */
export type RoomCommand = unknown;
/** A replay checksum taken every `CHECKSUM_EVERY` commands, keyed by command count. Opaque to the room. */
export type RoomChecksums = Readonly<Record<string, string>>;

// ---------------------------------------------------------------------------------------------------------------
// Host to room

export type HostMessage =
  | { readonly v: 1; readonly kind: "start"; readonly header: RoomHeader }
  /** The commands `from` .. `from + commands.length - 1`. A batch that does not continue the room's log is refused. */
  | {
      readonly v: 1;
      readonly kind: "commands";
      readonly from: number;
      readonly commands: readonly RoomCommand[];
      readonly checksums?: RoomChecksums;
    }
  /** A single-player Undo or Back out cut the log to its first `to` commands. */
  | { readonly v: 1; readonly kind: "rewind"; readonly to: number }
  /** The whole log again, answering `resend`. */
  | {
      readonly v: 1;
      readonly kind: "log";
      readonly header: RoomHeader;
      readonly commands: readonly RoomCommand[];
      readonly checksums?: RoomChecksums;
    }
  | { readonly v: 1; readonly kind: "end"; readonly outcome: unknown };

// ---------------------------------------------------------------------------------------------------------------
// Room to watcher

export type WatcherMessage =
  /** On join, and after a resend: the whole log so far. `header` is null while the host has not started. */
  | {
      readonly v: 1;
      readonly kind: "log";
      readonly header: RoomHeader | null;
      readonly commands: readonly RoomCommand[];
      readonly checksums: RoomChecksums;
      readonly ended: boolean;
      readonly outcome?: unknown;
    }
  | {
      readonly v: 1;
      readonly kind: "commands";
      readonly from: number;
      readonly commands: readonly RoomCommand[];
      readonly checksums?: RoomChecksums;
    }
  | { readonly v: 1; readonly kind: "rewind"; readonly to: number }
  | { readonly v: 1; readonly kind: "end"; readonly outcome: unknown }
  | { readonly v: 1; readonly kind: "presence"; readonly watchers: number }
  | { readonly v: 1; readonly kind: "host"; readonly connected: boolean }
  /** The room is closing (idle, ended, or the switch was turned off). */
  | { readonly v: 1; readonly kind: "closed"; readonly reason: "ended" | "idle" | "disabled" };

// ---------------------------------------------------------------------------------------------------------------
// Room to host

export type RoomToHostMessage =
  | { readonly v: 1; readonly kind: "presence"; readonly watchers: number }
  /** The room has no log (it woke empty, or a batch did not line up): send `log`. */
  | { readonly v: 1; readonly kind: "resend" }
  | { readonly v: 1; readonly kind: "closed"; readonly reason: "idle" | "disabled" };

/** Parses a message the host sent, or null when it is not one. Shape only; sizes are checked by the room. */
export function parseHostMessage(text: string): HostMessage | null {
  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch {
    return null;
  }
  if (typeof value !== "object" || value === null) return null;
  const m = value as Record<string, unknown>;
  if (m.v !== ROOM_PROTOCOL_VERSION) return null;
  const isCount = (n: unknown): n is number => typeof n === "number" && Number.isInteger(n) && n >= 0;
  const checksumsOk = m.checksums === undefined || (typeof m.checksums === "object" && m.checksums !== null);
  switch (m.kind) {
    case "start":
      return "header" in m ? (m as HostMessage) : null;
    case "commands":
      return isCount(m.from) && Array.isArray(m.commands) && checksumsOk ? (m as HostMessage) : null;
    case "rewind":
      return isCount(m.to) ? (m as HostMessage) : null;
    case "log":
      return "header" in m && Array.isArray(m.commands) && checksumsOk ? (m as HostMessage) : null;
    case "end":
      return m as HostMessage;
    default:
      return null;
  }
}
