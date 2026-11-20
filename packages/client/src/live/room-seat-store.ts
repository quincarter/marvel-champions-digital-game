/**
 * Where a device remembers the seat tokens a room gave it (issue #880), so a reload or a dropped connection puts the
 * same person back in the same seats (`hello.seatTokens`). A seat token is a bearer secret: it lives only here, in this
 * device's IndexedDB (read by the room worker), is sent only to the room's own socket and is never logged or posted to
 * the main thread. Keyed by room id; a record is dropped when it outlives the room's own idle limit.
 */
import { ROOM_IDLE_MS } from "@mc/sync-worker/room-protocol";

/** Seat id to token. */
export type SeatTokens = Readonly<Record<string, string>>;

export interface SeatTokenRecord {
  readonly roomId: string;
  readonly tokens: SeatTokens;
  readonly savedAt: number;
}

export interface SeatTokenStore {
  load(roomId: string): Promise<SeatTokenRecord | null>;
  save(record: SeatTokenRecord): Promise<void>;
  clear(roomId: string): Promise<void>;
  /** Drops every record that outlived the room's idle limit (a room the player never came back to). */
  sweep?(now: number): Promise<void>;
}

export const seatTokensFresh = (record: SeatTokenRecord, now: number): boolean => now - record.savedAt < ROOM_IDLE_MS;

export class MemorySeatTokenStore implements SeatTokenStore {
  readonly records = new Map<string, SeatTokenRecord>();
  async load(roomId: string): Promise<SeatTokenRecord | null> {
    return this.records.get(roomId) ?? null;
  }
  async save(record: SeatTokenRecord): Promise<void> {
    this.records.set(record.roomId, record);
  }
  async clear(roomId: string): Promise<void> {
    this.records.delete(roomId);
  }
  async sweep(now: number): Promise<void> {
    for (const record of [...this.records.values()])
      if (!seatTokensFresh(record, now)) this.records.delete(record.roomId);
  }
}

const DB_NAME = "mc-room-seats";
const STORE = "seats";

export class IdbSeatTokenStore implements SeatTokenStore {
  #db: Promise<IDBDatabase> | null = null;

  #open(): Promise<IDBDatabase> {
    this.#db ??= new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, 1);
      request.onupgradeneeded = () => request.result.createObjectStore(STORE, { keyPath: "roomId" });
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error ?? new Error("could not open the seat token store"));
    });
    return this.#db;
  }

  async #run<T>(mode: IDBTransactionMode, work: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
    const db = await this.#open();
    return new Promise((resolve, reject) => {
      const request = work(db.transaction(STORE, mode).objectStore(STORE));
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error ?? new Error("seat token store request failed"));
    });
  }

  async load(roomId: string): Promise<SeatTokenRecord | null> {
    return ((await this.#run("readonly", (s) => s.get(roomId))) as SeatTokenRecord | undefined) ?? null;
  }
  async save(record: SeatTokenRecord): Promise<void> {
    await this.#run("readwrite", (s) => s.put(record));
  }
  async clear(roomId: string): Promise<void> {
    await this.#run("readwrite", (s) => s.delete(roomId));
  }
  async sweep(now: number): Promise<void> {
    const db = await this.#open();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE, "readwrite");
      const request = tx.objectStore(STORE).openCursor();
      request.onsuccess = () => {
        const cursor = request.result;
        if (!cursor) return;
        if (!seatTokensFresh(cursor.value as SeatTokenRecord, now)) cursor.delete();
        cursor.continue();
      };
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error ?? new Error("seat token sweep failed"));
    });
  }
}
