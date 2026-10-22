/**
 * The shapes the device-sync engine passes between its parts (issue #276, step 2). Local IndexedDB and `localStorage`
 * stay the source of truth; sync maps them to small logical records, pushes the ones that changed and applies the ones
 * another device changed.
 *
 *  - `sync-local.ts` reads this device's save data as logical records and writes records back (`LocalSaveData`), and
 *    keeps what was last synced (`SyncStateStore`).
 *  - `sync-engine.ts` pulls, merges and pushes through `sync-api.ts`, and raises a `GameConflict` it can't settle.
 *
 * Logical keys (never sent: the server sees only an HMAC of them, `sync-records.ts`):
 *   game:<id>:meta           SaveMeta, plus `logHash` of the whole command log
 *   game:<id>:baseline       BaselineRow
 *   game:<id>:log:<n>        commands with seq in [n × LOG_CHUNK, (n + 1) × LOG_CHUNK)
 *   db:<database>:<store>:<key>   one record of any other store in SAVED_DATABASES (decks, campaigns, and stores
 *                            added later); a compound key is its parts joined with "/", a number
 *                            part written `#123` and a string part with `%`, `/` and a leading `#` escaped
 *                            (`sync-local.ts`), so the key reads back losslessly
 *   ls:<key>                 one `mc-*` localStorage entry
 */

/** Commands per log chunk: a turn's worth, so a turn usually rewrites one chunk. */
export const LOG_CHUNK = 64;

export interface LogicalRecord {
  readonly key: string;
  /** What gets sealed and uploaded. */
  readonly value: unknown;
  /** A stable hash of `value` (SHA-256 of canonical JSON, base64url), to tell whether it changed since last sync. */
  readonly hash: string;
  /**
   * When it last changed, for last-write-wins: the record's own `updatedAt` where it has one, otherwise the time this
   * device first saw its current hash (kept in `SyncStateStore`).
   */
  readonly stamp: number;
}

/** What a record looked like at the last successful sync. */
export interface SyncedEntry {
  readonly key: string;
  readonly recordKey: string;
  /** The server version this device last saw for it; 0 if never uploaded. */
  readonly version: number;
  readonly hash: string;
  readonly stamp: number;
  readonly deleted: boolean;
}

export interface SyncMeta {
  /** The server cursor this device has pulled up to. */
  readonly cursor: number;
  readonly lastSyncedAt: number | null;
  /** The space id the entries belong to; a different one means start over. */
  readonly spaceId: string | null;
  /** The space's `createdAt` as the server reported it; a different one means the space was wiped or recreated. */
  readonly epoch: number | null;
}

export interface SyncStateStore {
  meta(): Promise<SyncMeta>;
  setMeta(meta: SyncMeta): Promise<void>;
  entries(): Promise<ReadonlyMap<string, SyncedEntry>>;
  putEntries(entries: readonly SyncedEntry[]): Promise<void>;
  /** Forget everything (unlink, or a different space). */
  clear(): Promise<void>;
}

export interface LocalSaveData {
  /** Every logical record on this device now. */
  snapshot(): Promise<readonly LogicalRecord[]>;
  /**
   * Writes records that came from another device, and deletes the ones named in `deleted`, each game's records in
   * one transaction. The engine never passes records of the game open on this device right now (`openGameId`).
   *
   * Atomic per database, not across them: a record that can't be written aborts that database's whole share and
   * the call throws, but databases written before it (and localStorage, written last) keep their changes. The engine
   * must not advance its sync state after a throw, and the next sync, which re-applies the same records, converges.
   */
  apply(write: readonly { key: string; value: unknown }[], deleted: readonly string[]): Promise<void>;
  /** The game being played on this device right now, whose records sync must not overwrite; null when none. */
  openGameId(): string | null;
  /** Copies a game (all its records) under a new id, for "keep both". Returns the new id. */
  copyGame(records: readonly { key: string; value: unknown }[]): Promise<string>;
}

/** Both devices changed one game since they last synced, and neither log extends the other. */
export interface GameConflict {
  readonly gameId: string;
  /** For the prompt: the game's name or heroes and villain, and each side's round and last play time. */
  readonly local: { readonly round: number; readonly updatedAt: number };
  readonly remote: { readonly round: number; readonly updatedAt: number };
  readonly label: string;
  /** A campaign game cannot be copied, so "keep both" is not offered (answering it is a programming error). */
  readonly campaign: boolean;
}

/**
 * "later" leaves the game as it is on both sides: nothing is written, nothing is remembered, and the next sync asks
 * again (the player is busy on the table, or the game was opened while they decided).
 */
export type ConflictChoice = "keep-local" | "keep-remote" | "keep-both" | "later";
