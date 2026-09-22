/**
 * `CampaignStorage` on IndexedDB, in its own database (`mc-campaigns`) — see `campaign-storage.ts` for why that
 * separation from `mc-saves` and `mc-decks` matters. One object store, keyed by `CampaignRecord.id`: a campaign
 * log is small (a handful of fields and a short history, not a replayable game log), so unlike saved games
 * there's no reason to split it across stores the way `mc-saves` splits its ~68 KB baseline off the summary row.
 */
import type { CampaignStatus } from "@mc/engine";
import { summaryOf, type CampaignRecord, type CampaignStorage, type CampaignSummary } from "./campaign-storage.js";

const DB_NAME = "mc-campaigns";
const DB_VERSION = 1;
const STORE = "campaigns";

function settle<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("IndexedDB request failed"));
  });
}

function committed(transaction: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error ?? new Error("IndexedDB transaction failed"));
    transaction.onabort = () => reject(transaction.error ?? new Error("IndexedDB transaction aborted"));
  });
}

export class IdbCampaignStorage implements CampaignStorage {
  readonly #factory: IDBFactory;
  #db: Promise<IDBDatabase> | null = null;

  /** `factory` is injectable so a test can hand in a fresh fake database per case, as the other storages do. */
  constructor(factory: IDBFactory = indexedDB) {
    this.#factory = factory;
  }

  async create(record: CampaignRecord): Promise<void> {
    const db = await this.#open();
    const transaction = db.transaction(STORE, "readwrite");
    const done = committed(transaction);
    // `add`, not `put`: rejects a duplicate id rather than silently overwriting an existing campaign's whole log.
    transaction.objectStore(STORE).add(record);
    await done;
  }

  async put(record: CampaignRecord): Promise<void> {
    const db = await this.#open();
    const transaction = db.transaction(STORE, "readwrite");
    const done = committed(transaction);
    transaction.objectStore(STORE).put(record);
    await done;
  }

  async load(id: string): Promise<CampaignRecord | null> {
    const db = await this.#open();
    const transaction = db.transaction(STORE, "readonly");
    const done = committed(transaction);
    const found = await settle(transaction.objectStore(STORE).get(id) as IDBRequest<CampaignRecord | undefined>);
    await done;
    return found ?? null;
  }

  async list(): Promise<readonly CampaignSummary[]> {
    const db = await this.#open();
    const transaction = db.transaction(STORE, "readonly");
    const done = committed(transaction);
    const all = await settle(transaction.objectStore(STORE).getAll() as IDBRequest<CampaignRecord[]>);
    await done;
    return all.sort((a, b) => b.updatedAt - a.updatedAt).map(summaryOf);
  }

  async setStatus(id: string, status: CampaignStatus): Promise<void> {
    const db = await this.#open();
    const transaction = db.transaction(STORE, "readwrite");
    const done = committed(transaction);
    const store = transaction.objectStore(STORE);
    const record = await settle(store.get(id) as IDBRequest<CampaignRecord | undefined>);
    if (record) store.put({ ...record, status });
    await done;
  }

  #open(): Promise<IDBDatabase> {
    this.#db ??= new Promise<IDBDatabase>((resolve, reject) => {
      const request = this.#factory.open(DB_NAME, DB_VERSION);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE, { keyPath: "id" });
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error ?? new Error("could not open the campaigns database"));
    });
    return this.#db;
  }
}
