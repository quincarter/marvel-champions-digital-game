/**
 * `DeckStorage` on IndexedDB, in its own database (`mc-decks`) — see
 * `deck-storage.ts` for why that separation from `mc-saves` matters. One
 * object store, keyed by `Deck.id`: a deck is small (a card list plus a few
 * strings), so unlike saved games there's no reason to split it across
 * stores.
 */
import type { Deck, DeckId } from "@mc/content";
import type { DeckStorage } from "./deck-storage.js";

const DB_NAME = "mc-decks";
const DB_VERSION = 1;
const STORE = "decks";

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

export class IdbDeckStorage implements DeckStorage {
  readonly #factory: IDBFactory;
  #db: Promise<IDBDatabase> | null = null;

  /** `factory` is injectable so a test can hand in a fresh fake database per case, as `IdbGameStorage` does. */
  constructor(factory: IDBFactory = indexedDB) {
    this.#factory = factory;
  }

  async put(deck: Deck): Promise<void> {
    const db = await this.#open();
    const transaction = db.transaction(STORE, "readwrite");
    const done = committed(transaction);
    transaction.objectStore(STORE).put(deck);
    await done;
  }

  async get(id: DeckId): Promise<Deck | null> {
    const db = await this.#open();
    const transaction = db.transaction(STORE, "readonly");
    const done = committed(transaction);
    const found = await settle(transaction.objectStore(STORE).get(id as string) as IDBRequest<Deck | undefined>);
    await done;
    return found ?? null;
  }

  async list(): Promise<readonly Deck[]> {
    const db = await this.#open();
    const transaction = db.transaction(STORE, "readonly");
    const done = committed(transaction);
    const all = await settle(transaction.objectStore(STORE).getAll() as IDBRequest<Deck[]>);
    await done;
    return all;
  }

  async remove(id: DeckId): Promise<void> {
    const db = await this.#open();
    const transaction = db.transaction(STORE, "readwrite");
    const done = committed(transaction);
    transaction.objectStore(STORE).delete(id as string);
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
      request.onerror = () => reject(request.error ?? new Error("could not open the decks database"));
    });
    return this.#db;
  }
}
