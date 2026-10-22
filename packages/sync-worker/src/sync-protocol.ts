/**
 * The device-sync wire protocol (issue #276, step 2), shared by the Worker and the client
 * (`@mc/sync-worker/sync-protocol`). Pure: no Worker or DOM APIs.
 *
 * A sync space is one player's saves, kept in step across the devices that hold its recovery code. The server stores
 * opaque records: a key the client derived (an HMAC of the record's real name, so the server never learns game or deck
 * ids), a version the server assigns, a size, and ciphertext. It never sees a record's contents or its real name.
 *
 * Everything a device needs comes from the recovery code: 25 characters from the transfer alphabet (log2(31) × 25 ≈
 * 124 bits), shown grouped as five fives. The client derives the space id, the bearer token and the encryption key
 * from it with HKDF (`packages/client/src/sync/sync-credentials.ts`). The server stores only a SHA-256 of the token.
 * Linking another device sends the recovery code, encrypted, through a transfer room (`protocol.ts`).
 *
 * Versions are a single counter per space: every accepted write takes the next one, so "every change since cursor N"
 * is one ordered scan. A write names the version it was based on (0 for a new record); a stale base is refused as a
 * conflict and the client merges and retries.
 */

import { CODE_ALPHABET, type TransferErrorReason } from "./protocol.js";

export const RECOVERY_CODE_LENGTH = 25;

/** A space id is 32 lowercase hex characters (128 bits of an HKDF output). */
export const SPACE_ID_PATTERN = /^[0-9a-f]{32}$/;

/** A record key is 32 bytes in unpadded base64url. */
export const RECORD_KEY_PATTERN = /^[A-Za-z0-9_-]{43}$/;

/** The bearer token is 32 bytes in unpadded base64url, sent as `Authorization: Bearer <token>`. */
export const TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/;

/** Defaults; the deployed values are the Worker's vars. */
export const DEFAULT_MAX_SPACE_BYTES = 10 * 1024 * 1024;
export const MAX_RECORD_BYTES = 512 * 1024;
export const MAX_BATCH_OPS = 100;
export const MAX_BATCH_BYTES = 2 * 1024 * 1024;
export const MAX_CHANGES_PAGE = 200;
/** A changes page stops once its encoded data reaches this many bytes, though it always holds at least one record. */
export const MAX_CHANGES_PAGE_BYTES = 2 * 1024 * 1024;
/** Each record row (tombstones too) counts this many bytes toward the space cap on top of its encoded data. */
export const RECORD_ROW_OVERHEAD_BYTES = 64;

/** A space nobody has touched for this long is deleted by its alarm. */
export const SPACE_IDLE_TTL_MS = 365 * 24 * 60 * 60 * 1000;

// Routes, all under the space: `/sync/<spaceId>`.
//   POST   /sync/<id>                 create the space (idempotent for the same token); 201 SpaceInfo
//   GET    /sync/<id>                 SpaceInfo
//   GET    /sync/<id>/changes?since=N SyncChanges, at most MAX_CHANGES_PAGE records, `more` when there are others
//   POST   /sync/<id>/batch           SyncBatch → SyncBatchResult
//   DELETE /sync/<id>                 wipes the space; 204
//   GET    /sync/status               no token: 200 { sync: true } when sync is on, 503 `disabled` when off. Answered
//                                     before any rate limiter or space object, with a plain GET (no preflight).
// Creating answers 201 for a new space and 200 when the space exists and the token matches.
// A batch holds 1..MAX_BATCH_OPS ops applied in order and independently (a later op on the same key must name the
// version the earlier one produced); the decoded data of all ops totals at most MAX_BATCH_BYTES.
// `data` is unpadded base64url, non-empty; a record's size for the record and batch caps is its decoded length. The
// space cap counts what is stored: the encoded length of the data plus RECORD_ROW_OVERHEAD_BYTES per record row,
// tombstones included (a delete frees the data, not the overhead). `records` counts only live records.
// A space unused for SPACE_IDLE_TTL_MS is deleted (the server refreshes its alarm at most once a day).
// Every route needs the bearer token. A space that doesn't exist and a wrong token both answer 404 `not-found`, and
// count as a failed attempt for the IP. The one exception is create: an empty space answers 201 and an existing space
// with another token answers 404, so create reveals whether a space id is taken. Learning that needs the 128-bit id.
// Create is limited to a few new spaces per IP per day (429 `rate-limited`), and when the Worker has a TURNSTILE_SECRET
// it needs a valid `CF-Turnstile-Response` header, as a transfer upload does.
// Other limits, all 429 `rate-limited` with `Retry-After`: 300 requests per IP per 10 minutes; batches from an IP that
// has written 5,000 storage rows in 24 hours; per space, 60 batches and 1,500 ops per hour. Failed attempts (a bad
// token or an unknown space) block an IP (429 `blocked`) only when the last 10 minutes hold failures against 5
// different space ids, or 60 failures in all, so one stale device polling a deleted space cannot block a shared network.
// A request that reaches a space with the right token is not a failure.

export interface SpaceInfo {
  /** The highest version in the space (0 when empty). */
  readonly cursor: number;
  /**
   * The space's identity in time: its creation time. A client whose stored epoch differs from this one (the space was
   * wiped and created again, or expired and was re-created) must drop its sync state and resync from cursor 0.
   */
  readonly epoch: number;
  /** Counted bytes: encoded data plus RECORD_ROW_OVERHEAD_BYTES per record row, tombstones included. */
  readonly bytes: number;
  readonly maxBytes: number;
  readonly records: number;
  readonly createdAt: number;
}

export interface SyncRecord {
  readonly key: string;
  readonly version: number;
  /** A deleted record keeps its key and version (a tombstone) so other devices learn of the delete. */
  readonly deleted: boolean;
  /** Base64url ciphertext; absent when deleted. */
  readonly data?: string;
}

export interface SyncChanges {
  /** Pass as `since` next time: the version of the last record returned, or the space cursor when none. */
  readonly cursor: number;
  /** See `SpaceInfo.epoch`. A `since` above the space's cursor (an older epoch's) answers no records, the real cursor and the epoch. */
  readonly epoch: number;
  readonly more: boolean;
  readonly records: readonly SyncRecord[];
}

export interface SyncOp {
  readonly key: string;
  /** The version this write replaces; 0 for a key the client has never seen. */
  readonly baseVersion: number;
  /** Base64url ciphertext, or `deleted: true` and no data. */
  readonly data?: string;
  readonly deleted?: boolean;
}

export interface SyncBatch {
  readonly ops: readonly SyncOp[];
}

export type SyncOpResult =
  | { readonly key: string; readonly ok: true; readonly version: number }
  | { readonly key: string; readonly ok: false; readonly reason: "conflict"; readonly version: number };

export interface SyncBatchResult {
  readonly cursor: number;
  readonly results: readonly SyncOpResult[];
}

/**
 * Error reasons on top of the transfer ones (`TransferErrorReason`): a batch that would push the space over its byte cap
 * answers 413 `space-full`, one with more than MAX_BATCH_OPS ops answers 400 `too-many-ops`.
 */
export type SyncErrorReason = "space-full" | "too-many-ops";

/**
 * Every non-2xx answer's body on a /sync route. Status by reason: `disabled` 503, `origin` 403, `turnstile` 403 (a missing or bad token on space creation), `bad-request` 400 (also a
 * malformed batch), `too-many-ops` 400, `too-large` 413 (a record over MAX_RECORD_BYTES, a batch over MAX_BATCH_BYTES),
 * `space-full` 413, `rate-limited` 429 (per IP, or the space's batch-write cap), `blocked` 429 (too many failed
 * attempts from the IP), `not-found` 404 (no such space, wrong token, or a malformed id or token), `server` 500.
 * `rate-limited` and `blocked` carry a `Retry-After` header in seconds.
 */
export interface SyncError {
  readonly reason: TransferErrorReason | SyncErrorReason;
  readonly error: string;
}

const RECOVERY_CHAR = new RegExp(`^[${CODE_ALPHABET}]{${RECOVERY_CODE_LENGTH}}$`);

/** A typed recovery code in any case and grouping; `null` unless it is 25 good characters. */
export function parseRecoveryCode(input: string): string | null {
  const code = input.toUpperCase().replace(/[\s\-.]+/g, "");
  return RECOVERY_CHAR.test(code) ? code : null;
}

/** "ABCDE-FGHJK-MNPQR-STUVW-XYZ23" */
export function formatRecoveryCode(code: string): string {
  return code.match(/.{1,5}/g)!.join("-");
}
