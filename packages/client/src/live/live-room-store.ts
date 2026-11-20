/**
 * Where the live-room worker remembers a game's room (issue #876): after an app reload, resuming the same saved game
 * goes back to its room as the host instead of making a new one, so the people watching the old link stay with it.
 * The host token is a bearer secret: it lives only in this device's IndexedDB, is never sent anywhere but the room's
 * own socket, and is never logged. A record is dropped when the stream ends, the game is left, or it outlives the
 * room's own idle limit.
 */
import { ROOM_IDLE_MS } from "@mc/sync-worker/room-protocol";

export interface LiveRoomRecord {
  readonly gameKey: string;
  readonly roomId: string;
  readonly hostToken: string;
  readonly createdAt: number;
  /** Set for a lobby room (issue #880): its 6-character code, and the host's name for the same room's `hello`. */
  readonly code?: string;
  readonly name?: string;
  /** When the host last published (written at most once a minute); absent on a record from before this field. */
  readonly lastActiveAt?: number;
}

export interface LiveRoomStore {
  load(gameKey: string): Promise<LiveRoomRecord | null>;
  save(record: LiveRoomRecord): Promise<void>;
  clear(gameKey: string): Promise<void>;
}

/** Whether a record is still inside the room's own lifetime (a room closes 12 hours after its host last spoke, so age is measured from the last host activity). */
export const recordFresh = (record: LiveRoomRecord, now: number): boolean =>
  now - (record.lastActiveAt ?? record.createdAt) < ROOM_IDLE_MS;

export class MemoryRoomStore implements LiveRoomStore {
  readonly records = new Map<string, LiveRoomRecord>();
  async load(gameKey: string): Promise<LiveRoomRecord | null> {
    return this.records.get(gameKey) ?? null;
  }
  async save(record: LiveRoomRecord): Promise<void> {
    this.records.set(record.gameKey, record);
  }
  async clear(gameKey: string): Promise<void> {
    this.records.delete(gameKey);
  }
}

const DB_NAME = "mc-live-rooms";
const STORE = "rooms";

export class IdbRoomStore implements LiveRoomStore {
  #db: Promise<IDBDatabase> | null = null;

  #open(): Promise<IDBDatabase> {
    this.#db ??= new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, 1);
      request.onupgradeneeded = () => request.result.createObjectStore(STORE, { keyPath: "gameKey" });
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error ?? new Error("could not open the live room store"));
    });
    return this.#db;
  }

  async #run<T>(mode: IDBTransactionMode, work: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
    const db = await this.#open();
    return new Promise((resolve, reject) => {
      const request = work(db.transaction(STORE, mode).objectStore(STORE));
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error ?? new Error("live room store request failed"));
    });
  }

  async load(gameKey: string): Promise<LiveRoomRecord | null> {
    return ((await this.#run("readonly", (s) => s.get(gameKey))) as LiveRoomRecord | undefined) ?? null;
  }
  async save(record: LiveRoomRecord): Promise<void> {
    await this.#run("readwrite", (s) => s.put(record));
  }
  async clear(gameKey: string): Promise<void> {
    await this.#run("readwrite", (s) => s.delete(gameKey));
  }
}
