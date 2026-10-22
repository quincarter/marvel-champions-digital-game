/**
 * One sync space (issue #276, step 2): a player's encrypted records, versioned by a single counter. The logic works over
 * a plain storage interface (the Durable Object class is a thin wrapper), so tests run it without workerd.
 *
 * Storage layout, three kinds of row:
 *   `meta`          the SHA-256 of the bearer token (never the token), counters, and the recent batches
 *   `r:<key>`       a record's small stub: version, deleted, counted size. Read to check a write's base version.
 *   `v:<version>`   the version index: `<version>` zero-padded so keys sort numerically, holding the record's key and its
 *                   data. `changes?since=N` is an ordered `list` from `v:<N+1>`, and holds each record once, so a
 *                   rewrite deletes the record's old index row.
 *
 * Rows written (the free plan counts them): a batch writes `meta` once, then per accepted op 2 rows for a new key (stub
 * and index) or 3 for a rewrite or delete (stub, new index row, old index row deleted). A conflicting op writes nothing.
 * A request writes `meta` and the alarm only when the last one is over a day old. Tombstones stay forever (2 small rows)
 * so every device hears of a delete. Every answer reports the rows it wrote (`rows`), which the Worker adds to the
 * caller's daily row budget.
 *
 * Counted bytes toward the space cap are what is stored: the encoded data length plus RECORD_ROW_OVERHEAD_BYTES for
 * every record row, tombstones included.
 */

import type { KeyValueStorage } from "./env.js";
import type { TransferErrorReason } from "./protocol.js";
import { constantTimeEqual, hashProof } from "./room.js";
import type {
  SpaceInfo,
  SyncBatch,
  SyncBatchResult,
  SyncChanges,
  SyncErrorReason,
  SyncOp,
  SyncOpResult,
  SyncRecord,
} from "./sync-protocol.js";
import {
  MAX_BATCH_BYTES,
  MAX_BATCH_OPS,
  MAX_CHANGES_PAGE,
  MAX_CHANGES_PAGE_BYTES,
  MAX_RECORD_BYTES,
  RECORD_KEY_PATTERN,
  RECORD_ROW_OVERHEAD_BYTES,
  SPACE_IDLE_TTL_MS,
} from "./sync-protocol.js";

/** At most this many batches, and this many ops across them, per space per hour. */
export const BATCHES_PER_HOUR = 60;
export const OPS_PER_HOUR = 1500;
export const BATCH_WINDOW_MS = 60 * 60 * 1000;

/** The idle alarm is pushed out only when the last push is this old, to save writes. */
export const ALARM_SLACK_MS = 24 * 60 * 60 * 1000;

/** The real storage takes at most 128 keys per call. */
const STORAGE_KEY_LIMIT = 128;

/** A changes page reads the index in small lists so a page of large records never sits in memory whole. */
const LIST_CHUNK = 8;

const DATA_PATTERN = /^[A-Za-z0-9_-]+$/;

interface SpaceMeta {
  /** SHA-256 hex of the bearer token. */
  readonly tokenHash: string;
  readonly createdAt: number;
  /** The highest version assigned. */
  readonly cursor: number;
  /** Counted bytes: every record row's stored size, tombstones included. */
  readonly bytes: number;
  /** Live (not deleted) records. */
  readonly records: number;
  /** When the idle alarm was last pushed out; accurate to within ALARM_SLACK_MS. */
  readonly lastSeenAt: number;
  /** The batches of the last hour as [time, ops], for the write caps. */
  readonly batches: readonly (readonly [number, number])[];
}

interface RecordStub {
  readonly version: number;
  readonly deleted: boolean;
  /** Counted size: encoded data (0 when deleted) plus RECORD_ROW_OVERHEAD_BYTES. */
  readonly size: number;
}

interface IndexEntry {
  readonly key: string;
  readonly deleted: boolean;
  readonly data?: string;
}

/** Rows written by one call, threaded through (not stored on the object: requests can interleave at awaits). */
interface Tally {
  rows: number;
}

export type SyncOutcome<T> =
  | { readonly ok: true; readonly value: T; readonly created?: boolean; readonly rows: number }
  | {
      readonly ok: false;
      readonly status: 400 | 404 | 413 | 429;
      readonly reason: TransferErrorReason | SyncErrorReason;
      readonly retryAfterMs?: number;
    };

const notFound = { ok: false, status: 404, reason: "not-found" } as const;
const bad = (reason: TransferErrorReason | SyncErrorReason, status: 400 | 413 = 400): SyncOutcome<never> => ({
  ok: false,
  status,
  reason,
});

const quotaRefusal = { ok: false, status: 429, reason: "rate-limited" } as const;

const recordRow = (key: string) => `r:${key}`;
const versionRow = (version: number) => `v:${String(version).padStart(12, "0")}`;
const versionOfRow = (row: string) => Number(row.slice(2));

/** Decoded length of unpadded base64url; `null` when it is not valid. */
export function decodedLength(data: unknown): number | null {
  if (typeof data !== "string" || !DATA_PATTERN.test(data) || data.length % 4 === 1) return null;
  return Math.floor((data.length * 3) / 4);
}

function chunks<T>(items: readonly T[]): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += STORAGE_KEY_LIMIT) out.push(items.slice(i, i + STORAGE_KEY_LIMIT));
  return out;
}

export class SyncSpaceLogic {
  constructor(private readonly storage: KeyValueStorage) {}

  private async wipeAll(): Promise<void> {
    await this.storage.deleteAll();
    await this.storage.deleteAlarm();
  }

  /**
   * The space's meta when `token` matches, else `null`. Hashes before touching storage (an await on something other than
   * storage in the middle of writes would open the input gate). A space past its idle time is gone even if its alarm
   * has not run yet.
   */
  private async authenticate(token: string, now: number): Promise<SpaceMeta | null> {
    const tokenHash = await hashProof(token);
    const meta = await this.storage.get<SpaceMeta>("meta");
    if (!meta) return null;
    if (meta.lastSeenAt + SPACE_IDLE_TTL_MS <= now) {
      await this.wipeAll();
      return null;
    }
    return constantTimeEqual(tokenHash, meta.tokenHash) ? meta : null;
  }

  private slackExpired(meta: SpaceMeta, now: number): boolean {
    return now - meta.lastSeenAt >= ALARM_SLACK_MS;
  }

  /** Writes the meta and the alarm together (one atomic write). */
  private async push(meta: SpaceMeta, now: number, tally: Tally): Promise<void> {
    tally.rows += 2;
    await Promise.all([
      this.storage.put("meta", { ...meta, lastSeenAt: now }),
      this.storage.setAlarm(now + SPACE_IDLE_TTL_MS),
    ]);
  }

  /** Records an authenticated request: pushes the idle alarm out when the last push is over a day old. */
  private async touch(meta: SpaceMeta, now: number, tally: Tally): Promise<void> {
    if (this.slackExpired(meta, now)) await this.push(meta, now, tally);
  }

  private infoOf(meta: SpaceMeta, maxBytes: number): SpaceInfo {
    return {
      cursor: meta.cursor,
      epoch: meta.createdAt,
      bytes: meta.bytes,
      maxBytes,
      records: meta.records,
      createdAt: meta.createdAt,
    };
  }

  /** Creates the space on an empty object (201), or confirms it for the same token (200). A different token is 404. */
  async create(token: string, now: number, maxBytes: number, existingOnly = false): Promise<SyncOutcome<SpaceInfo>> {
    const tally: Tally = { rows: 0 };
    const tokenHash = await hashProof(token);
    const existing = await this.storage.get<SpaceMeta>("meta");
    if (existing && existing.lastSeenAt + SPACE_IDLE_TTL_MS > now) {
      if (!constantTimeEqual(tokenHash, existing.tokenHash)) return existingOnly ? quotaRefusal : notFound;
      await this.touch(existing, now, tally);
      return { ok: true, value: this.infoOf(existing, maxBytes), created: false, rows: tally.rows };
    }
    // Over the IP's creation quota: an existing space still confirms, nothing new is made.
    if (existingOnly) return quotaRefusal;
    if (existing) await this.wipeAll();
    const meta: SpaceMeta = {
      tokenHash,
      createdAt: now,
      cursor: 0,
      bytes: 0,
      records: 0,
      lastSeenAt: now,
      batches: [],
    };
    await this.push(meta, now, tally);
    return { ok: true, value: this.infoOf(meta, maxBytes), created: true, rows: tally.rows };
  }

  async info(token: string, now: number, maxBytes: number): Promise<SyncOutcome<SpaceInfo>> {
    const tally: Tally = { rows: 0 };
    const meta = await this.authenticate(token, now);
    if (!meta) return notFound;
    await this.touch(meta, now, tally);
    return { ok: true, value: this.infoOf(meta, maxBytes), rows: tally.rows };
  }

  /**
   * Records with a version above `since`, in version order: at most MAX_CHANGES_PAGE of them and about
   * MAX_CHANGES_PAGE_BYTES of data (always at least one record). The index is read in small lists, and `more` comes from
   * the cursor (the highest version always has an index row), so no record is read just to learn there is another.
   */
  async changes(token: string, since: number, now: number): Promise<SyncOutcome<SyncChanges>> {
    const tally: Tally = { rows: 0 };
    const meta = await this.authenticate(token, now);
    if (!meta) return notFound;
    if (!Number.isSafeInteger(since) || since < 0) return bad("bad-request");
    await this.touch(meta, now, tally);

    const records: SyncRecord[] = [];
    let dataBytes = 0;
    let start = versionRow(since + 1);
    let full = false;
    while (!full && records.length < MAX_CHANGES_PAGE) {
      const limit = Math.min(LIST_CHUNK, MAX_CHANGES_PAGE - records.length);
      const rows = await this.storage.list<IndexEntry>({ prefix: "v:", start, limit });
      let lastVersion = 0;
      for (const [row, entry] of rows) {
        const size = entry.data?.length ?? 0;
        if (records.length > 0 && dataBytes + size > MAX_CHANGES_PAGE_BYTES) {
          full = true;
          break;
        }
        lastVersion = versionOfRow(row);
        dataBytes += size;
        records.push({
          key: entry.key,
          version: lastVersion,
          deleted: entry.deleted,
          ...(entry.deleted || entry.data === undefined ? {} : { data: entry.data }),
        });
      }
      if (rows.size < limit) break;
      start = versionRow(lastVersion + 1);
    }
    const last = records.at(-1)?.version;
    return {
      ok: true,
      value: {
        cursor: last ?? meta.cursor,
        epoch: meta.createdAt,
        more: last !== undefined && last < meta.cursor,
        records,
      },
      rows: tally.rows,
    };
  }

  /** Validates a parsed batch; the ops, or the refusal. */
  private parseBatch(raw: string): SyncOp[] | SyncOutcome<never> {
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      return bad("bad-request");
    }
    const ops = (parsed as Partial<SyncBatch> | null)?.ops;
    if (!Array.isArray(ops) || ops.length === 0) return bad("bad-request");
    if (ops.length > MAX_BATCH_OPS) return bad("too-many-ops");
    let total = 0;
    for (const op of ops as unknown[]) {
      if (typeof op !== "object" || op === null) return bad("bad-request");
      const { key, baseVersion, data, deleted } = op as Partial<SyncOp>;
      if (typeof key !== "string" || !RECORD_KEY_PATTERN.test(key)) return bad("bad-request");
      if (typeof baseVersion !== "number" || !Number.isSafeInteger(baseVersion) || baseVersion < 0) {
        return bad("bad-request");
      }
      if (deleted === true) {
        if (data !== undefined) return bad("bad-request");
        continue;
      }
      if (deleted !== undefined && deleted !== false) return bad("bad-request");
      const size = decodedLength(data);
      if (size === null) return bad("bad-request");
      if (size > MAX_RECORD_BYTES) return bad("too-large", 413);
      total += size;
    }
    return total > MAX_BATCH_BYTES ? bad("too-large", 413) : (ops as SyncOp[]);
  }

  /**
   * Applies a batch. Ops go in order and independently: one whose `baseVersion` is not the record's current version
   * (0 = absent) answers a conflict and changes nothing. The batch as a whole is refused when its accepted ops would
   * push counted bytes over `maxBytes` (unless it shrinks the space), or when the space has had too many batches or ops
   * this hour. All writes are issued together, with no await between them, so storage commits them as one.
   */
  async batch(token: string, raw: string, now: number, maxBytes: number): Promise<SyncOutcome<SyncBatchResult>> {
    const tally: Tally = { rows: 0 };
    const meta = await this.authenticate(token, now);
    if (!meta) return notFound;
    const ops = this.parseBatch(raw);
    if (!Array.isArray(ops)) return ops;

    const recent = meta.batches.filter(([t]) => t > now - BATCH_WINDOW_MS);
    const opsUsed = recent.reduce((sum, [, n]) => sum + n, 0);
    if (recent.length >= BATCHES_PER_HOUR || opsUsed + ops.length > OPS_PER_HOUR) {
      return {
        ok: false,
        status: 429,
        reason: "rate-limited",
        retryAfterMs: Math.min(...recent.map(([t]) => t)) + BATCH_WINDOW_MS - now,
      };
    }

    // One read for every stub the batch names, then ops run against an in-memory view so a key written twice in a batch
    // sees its own earlier write.
    const keys = [...new Set(ops.map((op) => op.key))];
    const current = new Map<string, RecordStub>();
    for (const group of chunks(keys.map(recordRow))) {
      for (const [row, stub] of await this.storage.get<RecordStub>(group)) current.set(row.slice(2), stub);
    }

    const puts: Record<string, unknown> = {};
    const deletes = new Set<string>();
    const results: SyncOpResult[] = [];
    let cursor = meta.cursor;
    let bytes = meta.bytes;
    let records = meta.records;
    for (const op of ops) {
      const stub = current.get(op.key);
      const version = stub?.version ?? 0;
      if (op.baseVersion !== version) {
        results.push({ key: op.key, ok: false, reason: "conflict", version });
        continue;
      }
      cursor += 1;
      if (stub) {
        const oldRow = versionRow(stub.version);
        if (oldRow in puts) delete puts[oldRow];
        else deletes.add(oldRow);
        bytes -= stub.size;
        if (!stub.deleted) records -= 1;
      }
      const deleted = op.deleted === true;
      const size = (deleted ? 0 : (op.data?.length ?? 0)) + RECORD_ROW_OVERHEAD_BYTES;
      const next: RecordStub = { version: cursor, deleted, size };
      current.set(op.key, next);
      puts[recordRow(op.key)] = next;
      puts[versionRow(cursor)] = deleted ? { key: op.key, deleted } : { key: op.key, deleted, data: op.data };
      bytes += size;
      if (!deleted) records += 1;
      results.push({ key: op.key, ok: true, version: cursor });
    }

    if (bytes > maxBytes && bytes > meta.bytes) return bad("space-full", 413);

    const pushAlarm = this.slackExpired(meta, now);
    const nextMeta: SpaceMeta = {
      ...meta,
      cursor,
      bytes,
      records,
      batches: [...recent, [now, ops.length]],
      lastSeenAt: pushAlarm ? now : meta.lastSeenAt,
    };
    puts["meta"] = nextMeta;
    const putGroups = chunks(Object.keys(puts));
    const deleteGroups = chunks([...deletes]);
    tally.rows += Object.keys(puts).length + deletes.size + (pushAlarm ? 1 : 0);
    // No await between these calls: storage coalesces writes issued in one go into one atomic commit, so a failure
    // part-way leaves the space as it was.
    const writes: Promise<unknown>[] = [
      ...putGroups.map((group) => this.storage.put(Object.fromEntries(group.map((row) => [row, puts[row]])))),
      ...deleteGroups.map((group) => this.storage.delete(group)),
    ];
    if (pushAlarm) writes.push(this.storage.setAlarm(now + SPACE_IDLE_TTL_MS));
    await Promise.all(writes);
    return { ok: true, value: { cursor, results }, rows: tally.rows };
  }

  /** Wipes the space (the token must match). */
  async wipe(token: string, now: number): Promise<SyncOutcome<null>> {
    const meta = await this.authenticate(token, now);
    if (!meta) return notFound;
    await this.wipeAll();
    return { ok: true, value: null, rows: 0 };
  }

  /** The alarm: the space has been idle for the whole TTL. */
  async expire(): Promise<void> {
    await this.wipeAll();
  }
}
