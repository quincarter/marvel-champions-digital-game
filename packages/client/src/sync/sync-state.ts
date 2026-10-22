/**
 * What the last sync saw, kept in its own IndexedDB database, `mcsync-state`.
 *
 * The name deliberately does not start with `mc-` and is not in `SAVED_DATABASES`: sync state describes this device's
 * relationship to one sync space, so it must never travel in a save-data export or be synced itself (a restored
 * export would otherwise claim versions this device never uploaded). Two stores: `meta` (one row, `id: "meta"`) and
 * `entries`, one row per logical key.
 */
import { committed, settle } from "../save-data/save-data.js";
import type { SyncedEntry, SyncMeta, SyncStateStore } from "./sync-types.js";

export const SYNC_STATE_DB = "mcsync-state";
const DB_VERSION = 1;
const EMPTY_META: SyncMeta = { cursor: 0, lastSyncedAt: null, spaceId: null, epoch: null };

export class IdbSyncStateStore implements SyncStateStore {
  readonly #factory: IDBFactory;
  #db: Promise<IDBDatabase> | null = null;

  constructor(factory: IDBFactory = indexedDB) {
    this.#factory = factory;
  }

  async meta(): Promise<SyncMeta> {
    const db = await this.#open();
    const transaction = db.transaction("meta", "readonly");
    const done = committed(transaction);
    const row = await settle(
      transaction.objectStore("meta").get("meta") as IDBRequest<(SyncMeta & { id: string }) | undefined>,
    );
    await done;
    return row
      ? { cursor: row.cursor, lastSyncedAt: row.lastSyncedAt, spaceId: row.spaceId, epoch: row.epoch ?? null }
      : EMPTY_META;
  }

  async setMeta(meta: SyncMeta): Promise<void> {
    const db = await this.#open();
    const transaction = db.transaction("meta", "readwrite");
    const done = committed(transaction);
    transaction.objectStore("meta").put({ id: "meta", ...meta });
    await done;
  }

  async entries(): Promise<ReadonlyMap<string, SyncedEntry>> {
    const db = await this.#open();
    const transaction = db.transaction("entries", "readonly");
    const done = committed(transaction);
    const all = await settle(transaction.objectStore("entries").getAll() as IDBRequest<SyncedEntry[]>);
    await done;
    return new Map(all.map((entry) => [entry.key, entry]));
  }

  async putEntries(entries: readonly SyncedEntry[]): Promise<void> {
    if (entries.length === 0) return;
    const db = await this.#open();
    const transaction = db.transaction("entries", "readwrite");
    const done = committed(transaction);
    for (const entry of entries) transaction.objectStore("entries").put(entry);
    await done;
  }

  async clear(): Promise<void> {
    const db = await this.#open();
    const transaction = db.transaction(["meta", "entries"], "readwrite");
    const done = committed(transaction);
    transaction.objectStore("meta").clear();
    transaction.objectStore("entries").clear();
    await done;
  }

  #open(): Promise<IDBDatabase> {
    this.#db ??= new Promise<IDBDatabase>((resolve, reject) => {
      const request = this.#factory.open(SYNC_STATE_DB, DB_VERSION);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains("meta")) db.createObjectStore("meta", { keyPath: "id" });
        if (!db.objectStoreNames.contains("entries")) db.createObjectStore("entries", { keyPath: "key" });
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error ?? new Error("could not open the sync-state database"));
    });
    return this.#db;
  }
}
