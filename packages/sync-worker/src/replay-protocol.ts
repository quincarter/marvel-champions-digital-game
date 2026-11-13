/**
 * Replay share links (`/replay`, GitHub issue #693): a client uploads a replay file and gets back an id; anyone with
 * the id can fetch the file. Imported by the client as `@mc/sync-worker/replay-protocol`, so both sides share these shapes.
 * The Worker stores the file as it came, in R2, and never reads past the header check.
 */

/** The first line of a replay file (`packages/client/src/replay/replay-file.ts`); base64 of the gzip follows. */
export const REPLAY_FILE_HEADER = "MCREPLAY1";

/** A replay's id: 12 characters of the URL-safe base64 alphabet, 72 random bits. */
export const REPLAY_ID_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";
export const REPLAY_ID_LENGTH = 12;
export const REPLAY_ID_PATTERN = /^[A-Za-z0-9_-]{12}$/;

/** The upload cap when the MAX_REPLAY_BYTES var is missing or not a positive number. */
export const DEFAULT_MAX_REPLAY_BYTES = 256 * 1024;
/** The account-wide daily upload cap when the MAX_REPLAYS_PER_DAY var is missing or not a positive number. */
export const DEFAULT_MAX_REPLAYS_PER_DAY = 200;

/**
 * The header line, a line break, then one line of base64 (with an optional line break after it) that starts `H4sI`:
 * the base64 of gzip's magic bytes and deflate method (1f 8b 08), so the line at least opens like a gzip stream.
 */
const REPLAY_TEXT_PATTERN = /^MCREPLAY1\r?\nH4sI[A-Za-z0-9+/]*={0,2}(?:\r?\n)?$/;

/** Whether `text` has the shape `encodeReplay` writes; nothing past the shape is checked. */
export function isReplayText(text: string): boolean {
  return REPLAY_TEXT_PATTERN.test(text);
}

/** `POST /replay` answers 201 with this. */
export interface ReplayCreated {
  readonly id: string;
}

export type ReplayErrorReason =
  | "disabled"
  | "origin"
  | "bad-request"
  | "too-large"
  | "rate-limited"
  | "turnstile"
  | "not-found"
  | "full"
  | "server";

/** Every refusal, with the HTTP status the handler pairs it with. */
export interface ReplayError {
  readonly reason: ReplayErrorReason;
  readonly error: string;
}
