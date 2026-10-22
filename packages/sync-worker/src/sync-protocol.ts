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

import { CODE_ALPHABET } from "./protocol.js";

export const RECOVERY_CODE_LENGTH = 25;

/** A space id is 32 lowercase hex characters (128 bits of an HKDF output). */
export const SPACE_ID_PATTERN = /^[0-9a-f]{32}$/;

/** A record key is 32 bytes in unpadded base64url. */
export const RECORD_KEY_PATTERN = /^[A-Za-z0-9_-]{43}$/;

/** The bearer token is 32 bytes in unpadded base64url, sent as `Authorization: Bearer <token>`. */
export const TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/;

/** Defaults; the deployed values are the Worker's vars. */
export const DEFAULT_MAX_SPACE_BYTES = 20 * 1024 * 1024;
export const MAX_RECORD_BYTES = 512 * 1024;
export const MAX_BATCH_OPS = 100;
export const MAX_BATCH_BYTES = 2 * 1024 * 1024;
export const MAX_CHANGES_PAGE = 200;

/** A space nobody has touched for this long is deleted by its alarm. */
export const SPACE_IDLE_TTL_MS = 365 * 24 * 60 * 60 * 1000;

// Routes, all under the space: `/sync/<spaceId>`.
//   POST   /sync/<id>                 create the space (idempotent for the same token); 201 SpaceInfo
//   GET    /sync/<id>                 SpaceInfo
//   GET    /sync/<id>/changes?since=N SyncChanges, at most MAX_CHANGES_PAGE records, `more` when there are others
//   POST   /sync/<id>/batch           SyncBatch → SyncBatchResult
//   DELETE /sync/<id>                 wipes the space; 204
// Every route needs the bearer token. A space that doesn't exist and a wrong token both answer 404 `not-found`, and
// count as a failed attempt for the IP.

export interface SpaceInfo {
  /** The highest version in the space (0 when empty). */
  readonly cursor: number;
  /** Bytes of live (not deleted) record data. */
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

/** Error reasons on top of the transfer ones (`TransferErrorReason`): a full space answers 413 `space-full`. */
export type SyncErrorReason = "space-full" | "too-many-ops";

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
