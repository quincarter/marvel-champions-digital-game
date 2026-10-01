/**
 * Export and import of everything the client keeps on this device, as one `SaveFile` (`save-file.ts`).
 *
 * Export reads each database in `SAVED_DATABASES` store by store, plus the `mc-*` `localStorage` entries. Import
 * replaces all of it: every known store is cleared and refilled from the file in one transaction per database, and
 * every `mc-*` entry is removed before the file's are written, so nothing from before the import lingers beside it.
 * Callers validate with `parseSaveFile` first and reload the page after, since the storage classes and the
 * progression/guide caches hold what they read at startup.
 *
 * The factory and storage are injectable so the tests run on `fake-indexeddb` and a plain map.
 */
import { CLIENT_VERSION } from "../version.js";
import { SAVED_DATABASES, SAVED_LOCAL_STORAGE_PREFIX, type DatabaseSpec } from "./databases.js";
import { SAVE_FILE_FORMAT, SAVE_FILE_VERSION, type SavedDatabase, type SaveFile } from "./save-file.js";

/** The slice of `Storage` this needs; `localStorage` satisfies it. */
export type KeyValueStorage = Pick<Storage, "length" | "key" | "getItem" | "setItem" | "removeItem">;

export interface SaveDataDeps {
  readonly indexedDB: IDBFactory;
  /** `null` where `localStorage` is missing or throws (private mode, some webviews): only the databases travel. */
  readonly localStorage: KeyValueStorage | null;
  readonly now?: () => number;
}

function browserLocalStorage(): KeyValueStorage | null {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
}

export function browserSaveDataDeps(): SaveDataDeps {
  return { indexedDB: globalThis.indexedDB, localStorage: browserLocalStorage() };
}

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

/** Opens `spec` at its own version, creating any store that isn't there yet, the way its storage class would. */
function open(factory: IDBFactory, spec: DatabaseSpec): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = factory.open(spec.name, spec.version);
    request.onupgradeneeded = () => {
      const db = request.result;
      for (const store of spec.stores) {
        if (!db.objectStoreNames.contains(store.name)) {
          db.createObjectStore(store.name, { keyPath: store.keyPath as string | string[] });
        }
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error(`could not open ${spec.name}`));
  });
}

async function readDatabase(factory: IDBFactory, spec: DatabaseSpec): Promise<SavedDatabase> {
  const db = await open(factory, spec);
  try {
    const names = spec.stores.map((store) => store.name);
    const transaction = db.transaction(names, "readonly");
    const done = committed(transaction);
    const records = await Promise.all(names.map((name) => settle(transaction.objectStore(name).getAll())));
    await done;
    return { version: spec.version, stores: Object.fromEntries(names.map((name, i) => [name, records[i]!])) };
  } finally {
    db.close();
  }
}

async function writeDatabase(factory: IDBFactory, spec: DatabaseSpec, saved: SavedDatabase | undefined): Promise<void> {
  const db = await open(factory, spec);
  try {
    const names = spec.stores.map((store) => store.name);
    const transaction = db.transaction(names, "readwrite");
    const done = committed(transaction);
    for (const name of names) {
      const store = transaction.objectStore(name);
      store.clear();
      for (const record of saved?.stores[name] ?? []) store.put(record);
    }
    await done;
  } finally {
    db.close();
  }
}

function savedKeys(storage: KeyValueStorage): string[] {
  const keys: string[] = [];
  for (let i = 0; i < storage.length; i++) {
    const key = storage.key(i);
    if (key?.startsWith(SAVED_LOCAL_STORAGE_PREFIX)) keys.push(key);
  }
  return keys;
}

export async function exportSaveData(deps: SaveDataDeps = browserSaveDataDeps()): Promise<SaveFile> {
  const databases: Record<string, SavedDatabase> = {};
  for (const spec of SAVED_DATABASES) databases[spec.name] = await readDatabase(deps.indexedDB, spec);
  const localStorage: Record<string, string> = {};
  if (deps.localStorage) {
    for (const key of savedKeys(deps.localStorage).sort()) {
      const value = deps.localStorage.getItem(key);
      if (value !== null) localStorage[key] = value;
    }
  }
  return {
    format: SAVE_FILE_FORMAT,
    version: SAVE_FILE_VERSION,
    exportedAt: (deps.now ?? Date.now)(),
    appVersion: CLIENT_VERSION,
    databases,
    localStorage,
  };
}

/** Replaces everything on this device with `file`'s contents. `file` must come from `parseSaveFile`. */
export async function importSaveData(file: SaveFile, deps: SaveDataDeps = browserSaveDataDeps()): Promise<void> {
  for (const spec of SAVED_DATABASES) await writeDatabase(deps.indexedDB, spec, file.databases[spec.name]);
  const storage = deps.localStorage;
  if (!storage) return;
  for (const key of savedKeys(storage)) storage.removeItem(key);
  for (const [key, value] of Object.entries(file.localStorage)) storage.setItem(key, value);
}
