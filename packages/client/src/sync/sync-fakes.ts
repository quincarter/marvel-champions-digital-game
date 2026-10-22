/**
 * In-memory stand-ins for the sync engine's collaborators, for tests: a server with the sync protocol's semantics
 * (one version counter, base-version conflicts, paged changes, size limits), a save-data store and a sync-state store.
 */
import {
  MAX_BATCH_BYTES,
  MAX_BATCH_OPS,
  MAX_CHANGES_PAGE,
  type SyncOp,
  type SyncOpResult,
  type SyncRecord,
} from "@mc/sync-worker/sync-protocol";
import type { SyncCredentials } from "./sync-credentials.js";
import type { SyncEngineApi } from "./sync-engine.js";
import { hashValue, rowStamp } from "./sync-local.js";
import { recordKeyOf, sealRecord } from "./sync-records.js";
import {
  LOG_CHUNK,
  type LocalSaveData,
  type LogicalRecord,
  type SyncedEntry,
  type SyncMeta,
  type SyncStateStore,
} from "./sync-types.js";

interface StoredRecord {
  version: number;
  deleted: boolean;
  data?: string;
}

export class FakeServer {
  readonly records = new Map<string, StoredRecord>();
  cursor = 0;
  epoch = 1000;
  exists = false;
  pageSize = MAX_CHANGES_PAGE;
  /** Calls made, by route. */
  readonly calls = { changes: 0, batch: 0, createSpace: 0 };
  /** The op counts of each batch received. */
  readonly batches: number[] = [];
  /** Answer `unavailable` instead of working. */
  down = false;
  /** Called before a batch is applied (to slip another device's write in first). */
  beforeBatch: (() => Promise<void> | void) | null = null;
  /** Fail (unavailable) the Nth batch call (1-based) once. */
  failBatchNumber: number | null = null;

  readonly api: SyncEngineApi = {
    createSpace: async () => {
      this.calls.createSpace++;
      if (this.down) return { ok: false, failure: { kind: "unavailable" } };
      const created = !this.exists;
      this.exists = true;
      return { ok: true, created, info: this.info() };
    },
    changes: async (_creds, since) => {
      this.calls.changes++;
      if (this.down) return { ok: false, failure: { kind: "unavailable" } };
      if (!this.exists) return { ok: false, failure: { kind: "not-found" } };
      const all = [...this.records.entries()]
        .filter(([, r]) => r.version > since)
        .sort((a, b) => a[1].version - b[1].version);
      const page = all.slice(0, this.pageSize);
      const more = all.length > page.length;
      const records: SyncRecord[] = page.map(([key, r]) => ({
        key,
        version: r.version,
        deleted: r.deleted,
        ...(r.deleted ? {} : { data: r.data }),
      }));
      const cursor = more ? page[page.length - 1]![1].version : this.cursor;
      return { ok: true, changes: { cursor, more, records, epoch: this.epoch } };
    },
    batch: async (_creds, ops) => {
      this.calls.batch++;
      this.batches.push(ops.length);
      if (this.down) return { ok: false, failure: { kind: "unavailable" } };
      if (this.failBatchNumber === this.calls.batch) return { ok: false, failure: { kind: "unavailable" } };
      if (ops.length > MAX_BATCH_OPS) return { ok: false, failure: { kind: "too-large" } };
      const bytes = ops.reduce((n, op) => n + Math.floor(((op.data?.length ?? 0) * 3) / 4), 0);
      if (bytes > MAX_BATCH_BYTES) return { ok: false, failure: { kind: "too-large" } };
      await this.beforeBatch?.();
      return { ok: true, result: this.apply(ops) };
    },
  };

  private info() {
    return {
      cursor: this.cursor,
      bytes: 0,
      maxBytes: 1,
      records: this.records.size,
      createdAt: this.epoch,
      epoch: this.epoch,
    };
  }

  private apply(ops: readonly SyncOp[]) {
    const results: SyncOpResult[] = [];
    for (const op of ops) {
      const current = this.records.get(op.key);
      const version = current?.version ?? 0;
      if (op.baseVersion !== version) {
        results.push({ key: op.key, ok: false, reason: "conflict", version });
        continue;
      }
      this.cursor++;
      this.records.set(op.key, {
        version: this.cursor,
        deleted: op.deleted === true,
        ...(op.deleted ? {} : { data: op.data }),
      });
      results.push({ key: op.key, ok: true, version: this.cursor });
    }
    return { cursor: this.cursor, results };
  }

  /** Another device's write that this one has not seen, made straight on the server. */
  async foreignWrite(creds: SyncCredentials, key: string, value: unknown, stamp: number): Promise<void> {
    const { recordKey, data } = await sealRecord(creds, key, value, stamp);
    this.exists = true;
    this.cursor++;
    this.records.set(recordKey, { version: this.cursor, deleted: false, data });
  }

  /** The space is deleted and made again: a new epoch, nothing in it. */
  recreate(): void {
    this.records.clear();
    this.cursor = 0;
    this.epoch++;
  }

  liveCount(): number {
    return [...this.records.values()].filter((r) => !r.deleted).length;
  }

  async versionOf(creds: SyncCredentials, key: string): Promise<number | undefined> {
    return this.records.get(await recordKeyOf(creds, key))?.version;
  }
}

export class FakeState implements SyncStateStore {
  metaValue: SyncMeta = { cursor: 0, lastSyncedAt: null, spaceId: null, epoch: null };
  readonly map = new Map<string, SyncedEntry>();
  async meta() {
    return this.metaValue;
  }
  async setMeta(meta: SyncMeta) {
    this.metaValue = meta;
  }
  async entries() {
    return new Map(this.map);
  }
  async putEntries(entries: readonly SyncedEntry[]) {
    for (const entry of entries) this.map.set(entry.key, entry);
  }
  async clear() {
    this.metaValue = { cursor: 0, lastSyncedAt: null, spaceId: null, epoch: null };
    this.map.clear();
  }
}

const GAME = /^game:(.+):(meta|baseline|log:\d+)$/;

export class FakeLocal implements LocalSaveData {
  readonly values = new Map<string, unknown>();
  open: string | null = null;
  copies = 0;
  /** Makes the next `apply` throw. */
  failApply = false;
  /** Keys that exist on this device but are invisible to snapshots (a store this build doesn't know). */
  hidden = new Set<string>();
  readonly applied: { writes: string[]; deletes: string[] }[] = [];

  openGameId() {
    return this.open;
  }

  async snapshot(): Promise<readonly LogicalRecord[]> {
    const out: LogicalRecord[] = [];
    for (const [key, value] of [...this.values].sort((a, b) => (a[0] < b[0] ? -1 : 1))) {
      if (this.hidden.has(key)) continue;
      const id = GAME.exec(key)?.[1];
      const metaValue = id === undefined ? undefined : (this.values.get(`game:${id}:meta`) as { updatedAt?: number });
      const own = rowStamp(value);
      const stamp = own > 0 ? own : (metaValue?.updatedAt ?? 0);
      out.push({ key, value, hash: await hashValue(value), stamp });
    }
    return out;
  }

  async apply(write: readonly { key: string; value: unknown }[], deleted: readonly string[]) {
    if (this.failApply) throw new Error("disk full");
    for (const key of [...write.map((w) => w.key), ...deleted]) {
      if (this.open !== null && GAME.exec(key)?.[1] === this.open) throw new Error(`wrote the open game ${key}`);
    }
    this.applied.push({ writes: write.map((w) => w.key), deletes: [...deleted] });
    for (const key of deleted) this.values.delete(key);
    for (const { key, value } of write) this.values.set(key, value);
  }

  async copyGame(records: readonly { key: string; value: unknown }[]) {
    const id = `copy-${++this.copies}`;
    const chunks: [string, string][] = [];
    for (const { key, value } of records) {
      const m = GAME.exec(key);
      if (!m) continue;
      const v = m[2] === "meta" ? { ...(value as object), id } : value;
      this.values.set(`game:${id}:${m[2]}`, v);
      if (m[2]!.startsWith("log:")) chunks.push([`game:${id}:${m[2]}`, await hashValue(value)]);
    }
    // The log hash names the chunks by key, so a copy under a new id has its own.
    const meta = this.values.get(`game:${id}:meta`) as object | undefined;
    if (meta) this.values.set(`game:${id}:meta`, { ...meta, logHash: await hashValue(chunks) });
    return id;
  }

  /** Writes a game of `count` commands (each `${tag}${seq}`), as sync-local would present it. */
  async setGame(id: string, count: number, opts: { tag?: string; updatedAt?: number; campaignId?: string } = {}) {
    const tag = opts.tag ?? "c";
    const commands = Array.from({ length: count }, (_, i) => `${tag}${i}`);
    for (const key of [...this.values.keys()]) if (key.startsWith(`game:${id}:log:`)) this.values.delete(key);
    const logChunks: [string, string][] = [];
    for (let n = 0; n * LOG_CHUNK < count; n++) {
      const value = { commands: commands.slice(n * LOG_CHUNK, (n + 1) * LOG_CHUNK) };
      this.values.set(`game:${id}:log:${n}`, value);
      logChunks.push([`game:${id}:log:${n}`, await hashValue(value)]);
    }
    this.values.set(`game:${id}:baseline`, { gameId: id, marker: "b" });
    this.values.set(`game:${id}:meta`, {
      id,
      updatedAt: opts.updatedAt ?? 1000 + count,
      round: 1 + Math.floor(count / 10),
      commandCount: count,
      status: "active",
      campaignId: opts.campaignId ?? null,
      config: { scenarioId: "rhino" },
      logHash: await hashValue(logChunks),
    });
  }

  gameCommands(id: string): string[] {
    const out: string[] = [];
    for (let n = 0; this.values.has(`game:${id}:log:${n}`); n++) {
      out.push(...(this.values.get(`game:${id}:log:${n}`) as { commands: string[] }).commands);
    }
    return out;
  }

  setDeck(id: string, name: string, updatedAt: number) {
    // A deck's updatedAt is an ISO date string, as in the real store.
    this.values.set(`db:mc-decks:decks:${id}`, { id, name, updatedAt: new Date(updatedAt).toISOString() });
  }
}
