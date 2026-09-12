/**
 * `GameStorage` on IndexedDB: what makes a game survive a refresh.
 *
 * Three object stores, so each read touches only what it needs:
 *  - `games` — one small summary row per game (config, status, round, counts).
 *    Listing games and finding "Continue" read only this.
 *  - `baselines` — the ~68 KB replay baseline, one per game, read only on load.
 *  - `commands` — one row per command, keyed `[gameId, seq]`, so a game's log
 *    is a key range and each append is one small put.
 *
 * Every append is a single readwrite transaction over `games` and `commands`.
 * IndexedDB runs readwrite transactions with overlapping scope strictly in the
 * order they were created, which is what keeps the log in command order even
 * though writes are not awaited before the next command is applied.
 *
 * It works identically on the main thread and inside the engine worker; the
 * worker is where the game's owner lives, so that is where it is used.
 */

import type { Command } from "@mc/engine";
import type { StateWithoutPool } from "./host.js";
import { newestActive, type GameStorage, type SaveMeta, type SaveProgress, type SaveStatus, type StoredGame } from "./game-storage.js";

const DB_NAME = "mc-saves";
const DB_VERSION = 1;

interface CommandRow {
  readonly gameId: string;
  readonly seq: number;
  readonly command: Command;
}

interface BaselineRow {
  readonly gameId: string;
  readonly state: StateWithoutPool;
}

/** An `IDBRequest` as a promise. */
function settle<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("IndexedDB request failed"));
  });
}

/** Resolves when a transaction commits; rejects on error or abort, carrying the cause. */
function committed(transaction: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error ?? new Error("IndexedDB transaction failed"));
    transaction.onabort = () => reject(transaction.error ?? new Error("IndexedDB transaction aborted"));
  });
}

export class IdbGameStorage implements GameStorage {
  readonly #factory: IDBFactory;
  #db: Promise<IDBDatabase> | null = null;

  /** `factory` is injectable so a test can hand in a fresh fake database per case. */
  constructor(factory: IDBFactory = indexedDB) {
    this.#factory = factory;
  }

  async create(meta: SaveMeta, initialState: StateWithoutPool): Promise<void> {
    const db = await this.#open();
    const transaction = db.transaction(["games", "baselines"], "readwrite");
    const done = committed(transaction);
    const games = transaction.objectStore("games");
    const existing = await settle(games.getAll() as IDBRequest<SaveMeta[]>);
    for (const game of existing) {
      if (game.status === "active") games.put({ ...game, status: "abandoned" satisfies SaveStatus });
    }
    games.put(meta);
    transaction.objectStore("baselines").put({ gameId: meta.id, state: initialState } satisfies BaselineRow);
    await done;
  }

  async append(gameId: string, seq: number, command: Command, progress: SaveProgress): Promise<void> {
    const db = await this.#open();
    const transaction = db.transaction(["games", "commands"], "readwrite");
    const done = committed(transaction);
    const games = transaction.objectStore("games");
    const meta = await settle(games.get(gameId) as IDBRequest<SaveMeta | undefined>);
    if (!meta) {
      transaction.abort();
      await done.catch(() => undefined);
      throw new Error(`no saved game ${gameId}`);
    }
    if (seq !== meta.commandCount) {
      transaction.abort();
      await done.catch(() => undefined);
      throw new Error(`save out of order: expected command ${meta.commandCount}, got ${seq}`);
    }
    transaction.objectStore("commands").put({ gameId, seq, command } satisfies CommandRow);
    games.put({ ...meta, ...progress });
    await done;
  }

  async load(gameId: string): Promise<StoredGame | null> {
    const db = await this.#open();
    const transaction = db.transaction(["games", "baselines", "commands"], "readonly");
    const done = committed(transaction);
    const [meta, baseline, rows] = await Promise.all([
      settle(transaction.objectStore("games").get(gameId) as IDBRequest<SaveMeta | undefined>),
      settle(transaction.objectStore("baselines").get(gameId) as IDBRequest<BaselineRow | undefined>),
      settle(
        transaction.objectStore("commands").getAll(IDBKeyRange.bound([gameId, 0], [gameId, Infinity])) as IDBRequest<CommandRow[]>,
      ),
    ]);
    await done;
    if (!meta || !baseline) return null;
    // A key range over `[gameId, seq]` already comes back in seq order.
    return { meta, initialState: baseline.state, commands: rows.map((row) => row.command) };
  }

  async latestActive(): Promise<SaveMeta | null> {
    return newestActive(await this.#allGames());
  }

  async list(): Promise<readonly SaveMeta[]> {
    return (await this.#allGames()).sort((a, b) => b.updatedAt - a.updatedAt);
  }

  async setStatus(gameId: string, status: SaveStatus): Promise<void> {
    const db = await this.#open();
    const transaction = db.transaction("games", "readwrite");
    const done = committed(transaction);
    const games = transaction.objectStore("games");
    const meta = await settle(games.get(gameId) as IDBRequest<SaveMeta | undefined>);
    if (meta) games.put({ ...meta, status });
    await done;
  }

  async #allGames(): Promise<SaveMeta[]> {
    const db = await this.#open();
    const transaction = db.transaction("games", "readonly");
    const done = committed(transaction);
    const games = await settle(transaction.objectStore("games").getAll() as IDBRequest<SaveMeta[]>);
    await done;
    return games;
  }

  #open(): Promise<IDBDatabase> {
    this.#db ??= new Promise<IDBDatabase>((resolve, reject) => {
      const request = this.#factory.open(DB_NAME, DB_VERSION);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains("games")) db.createObjectStore("games", { keyPath: "id" });
        if (!db.objectStoreNames.contains("baselines")) db.createObjectStore("baselines", { keyPath: "gameId" });
        if (!db.objectStoreNames.contains("commands")) db.createObjectStore("commands", { keyPath: ["gameId", "seq"] });
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error ?? new Error("could not open the saved-games database"));
    });
    return this.#db;
  }
}
