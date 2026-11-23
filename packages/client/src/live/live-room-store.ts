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
  /** The admission id of the game the lobby room admitted (from `started`): lets a reloaded host resume it before its first command. */
  readonly gid?: string;
  /** When the host last published (written at most once a minute); absent on a record from before this field. */
  readonly lastActiveAt?: number;
}

/**
 * The record a hosted lobby room keeps under its own code, before and apart from any game (reload rejoin): the address's
 * `?room=<CODE>` finds the host token through it, so a host who reloads in the lobby, with no game saved yet, comes back
 * as the host. Same shape as a game's record (`gameKey` is this key), so the one store and the idle limit serve both.
 */
export const lobbyRecordKey = (code: string): string => `room:${code}`;

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

  /** The open connection, shared by every call; dropped on a failed open, a close or a version change so the next call reopens. */
  #open(): Promise<IDBDatabase> {
    if (this.#db) return this.#db;
    const opening: Promise<IDBDatabase> = new Promise<IDBDatabase>((resolve, reject) => {
      // A synchronous throw from open() (storage disabled) becomes a rejection like any other open failure.
      const request = indexedDB.open(DB_NAME, 1);
      request.onupgradeneeded = () => request.result.createObjectStore(STORE, { keyPath: "gameKey" });
      request.onsuccess = () => {
        const db = request.result;
        const drop = () => {
          if (this.#db === opening) this.#db = null;
        };
        db.onclose = drop;
        db.onversionchange = () => {
          drop();
          db.close();
        };
        resolve(db);
      };
      request.onerror = () => reject(request.error ?? new Error("could not open the live room store"));
    });
    this.#db = opening;
    // A rejected open must not be cached: the controller's retries need a fresh attempt.
    opening.catch(() => {
      if (this.#db === opening) this.#db = null;
    });
    return opening;
  }

  async #run<T>(mode: IDBTransactionMode, work: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
    const db = await this.#open();
    return new Promise((resolve, reject) => {
      // A request succeeding does not make the write durable: the transaction can still abort (quota, shutdown), which
      // would roll back the room id and host token after save() resolved. Resolve only when it completes.
      const tx = db.transaction(STORE, mode);
      const request = work(tx.objectStore(STORE));
      request.onerror = () => reject(request.error ?? new Error("live room store request failed"));
      tx.onabort = () => reject(tx.error ?? request.error ?? new Error("live room store transaction aborted"));
      tx.onerror = () => reject(tx.error ?? request.error ?? new Error("live room store transaction failed"));
      tx.oncomplete = () => resolve(request.result);
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
