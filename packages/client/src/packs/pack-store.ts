/**
 * Installed custom packs (docs/custom-content-packs.md §7.1): manifests and files in IndexedDB, behind `PackStorage` so a
 * native backend can replace it later. A file is a `Blob`, served as a same-origin `blob:` URL.
 *
 * An install is ONE IndexedDB transaction that clears the pack's older files, writes every file, then writes the
 * manifest last; any failure aborts the transaction, so nothing half-installed is ever visible.
 */
import type { PackManifest } from "@mc/content";

/** One installed pack, as the manifests store holds it. */
export interface InstalledPack {
  readonly id: string;
  readonly version: string;
  readonly manifest: PackManifest;
  /** ISO 8601 time of the install. */
  readonly installedAt: string;
  /** The store no longer offers it; it stays playable (§11.4). */
  readonly withdrawn: boolean;
}

export type PackFileInput = Blob | Uint8Array;

export interface PackStorage {
  list(): Promise<InstalledPack[]>;
  get(id: string): Promise<InstalledPack | undefined>;
  /** Replaces any installed version of the pack. Rejects, leaving the old state, if anything fails. */
  install(manifest: PackManifest, files: ReadonlyMap<string, PackFileInput>): Promise<InstalledPack>;
  remove(id: string): Promise<void>;
  fileBlob(id: string, path: string): Promise<Blob | undefined>;
  /** A cached `blob:` URL for the file, or undefined when it is not installed. */
  objectUrl(id: string, path: string): Promise<string | undefined>;
  /** Revokes the URL `objectUrl` handed out for one file, or every file of the pack when `path` is omitted. */
  revoke(id: string, path?: string): void;
  /** Bytes of every stored file. */
  totalBytes(): Promise<number>;
  /** Bytes of one pack's files. */
  packBytes(id: string): Promise<number>;
  markWithdrawn(id: string, withdrawn: boolean): Promise<void>;
}

const DB_NAME = "mc-packs";
const DB_VERSION = 1;
const MANIFESTS = "manifests";
const FILES = "files";

export function packFileKey(id: string, version: string, path: string): string {
  return `${id}@${version}/${path}`;
}

/** Every file key of a pack, whatever its version. Ids never contain `@`. */
function packRange(id: string): IDBKeyRange {
  return IDBKeyRange.bound(`${id}@`, `${id}@￿`);
}

function requestDone<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("IndexedDB request failed"));
  });
}

function transactionDone(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error("IndexedDB transaction failed"));
    tx.onabort = () => reject(tx.error ?? new Error("IndexedDB transaction aborted"));
  });
}

function toBlob(value: PackFileInput): Blob {
  if (value instanceof Blob) return value;
  if (value instanceof Uint8Array) return new Blob([value as Uint8Array<ArrayBuffer>]);
  throw new Error("A pack file must be a Blob or Uint8Array");
}

export interface IdbPackStoreOptions {
  readonly factory?: IDBFactory;
  readonly dbName?: string;
  /** Test seam: runs inside the install transaction after the files are queued, before the manifest. */
  readonly beforeManifest?: () => void;
}

export class IdbPackStore implements PackStorage {
  private dbPromise: Promise<IDBDatabase> | undefined;
  private persistAsked = false;
  /** In-flight and finished URL requests by `<id>/<path>`, so concurrent callers share one `createObjectURL`. */
  private readonly pending = new Map<string, Promise<string | undefined>>();
  private readonly urls = new Map<string, string>();

  constructor(private readonly options: IdbPackStoreOptions = {}) {}

  private db(): Promise<IDBDatabase> {
    this.dbPromise ??= new Promise((resolve, reject) => {
      const factory = this.options.factory ?? indexedDB;
      const open = factory.open(this.options.dbName ?? DB_NAME, DB_VERSION);
      open.onupgradeneeded = () => {
        const db = open.result;
        if (!db.objectStoreNames.contains(MANIFESTS)) db.createObjectStore(MANIFESTS, { keyPath: "id" });
        if (!db.objectStoreNames.contains(FILES)) db.createObjectStore(FILES);
      };
      open.onsuccess = () => resolve(open.result);
      open.onerror = () => reject(open.error ?? new Error("Could not open the pack store"));
    });
    return this.dbPromise;
  }

  /** Closes the connection (tests, and a later backend swap). */
  async close(): Promise<void> {
    if (!this.dbPromise) return;
    const db = await this.dbPromise;
    db.close();
    this.dbPromise = undefined;
  }

  async list(): Promise<InstalledPack[]> {
    const db = await this.db();
    return requestDone(db.transaction(MANIFESTS).objectStore(MANIFESTS).getAll() as IDBRequest<InstalledPack[]>);
  }

  async get(id: string): Promise<InstalledPack | undefined> {
    const db = await this.db();
    return requestDone(
      db.transaction(MANIFESTS).objectStore(MANIFESTS).get(id) as IDBRequest<InstalledPack | undefined>,
    );
  }

  async install(manifest: PackManifest, files: ReadonlyMap<string, PackFileInput>): Promise<InstalledPack> {
    // Everything that can fail without the database fails first.
    const blobs = new Map<string, Blob>();
    for (const [path, value] of files) blobs.set(path, toBlob(value));
    this.askPersist();
    const db = await this.db();
    const record: InstalledPack = {
      id: manifest.id,
      version: manifest.version,
      manifest,
      installedAt: new Date().toISOString(),
      withdrawn: false,
    };
    const tx = db.transaction([MANIFESTS, FILES], "readwrite");
    const done = transactionDone(tx);
    done.catch(() => {});
    try {
      const fileStore = tx.objectStore(FILES);
      fileStore.delete(packRange(manifest.id));
      for (const [path, blob] of blobs) fileStore.put(blob, packFileKey(manifest.id, manifest.version, path));
      this.options.beforeManifest?.();
      tx.objectStore(MANIFESTS).put(record);
    } catch (error) {
      try {
        tx.abort();
      } catch {
        // already finished
      }
      await done.catch(() => {});
      throw error;
    }
    await done;
    this.revoke(manifest.id);
    return record;
  }

  async remove(id: string): Promise<void> {
    const db = await this.db();
    const tx = db.transaction([MANIFESTS, FILES], "readwrite");
    tx.objectStore(FILES).delete(packRange(id));
    tx.objectStore(MANIFESTS).delete(id);
    await transactionDone(tx);
    this.revoke(id);
  }

  async fileBlob(id: string, path: string): Promise<Blob | undefined> {
    const db = await this.db();
    // One read-only transaction over both stores, so an install cannot slip between the manifest and the file.
    const tx = db.transaction([MANIFESTS, FILES]);
    const installed = (await requestDone(tx.objectStore(MANIFESTS).get(id))) as InstalledPack | undefined;
    if (!installed) return undefined;
    return requestDone(
      tx.objectStore(FILES).get(packFileKey(id, installed.version, path)) as IDBRequest<Blob | undefined>,
    );
  }

  objectUrl(id: string, path: string): Promise<string | undefined> {
    const key = `${id}/${path}`;
    const known = this.pending.get(key);
    if (known) return known;
    let request: Promise<string | undefined> | undefined;
    request = (async () => {
      const blob = await this.fileBlob(id, path);
      if (!blob) return undefined;
      // Revoked or reinstalled while the read was in flight: this result is stale.
      if (this.pending.get(key) !== request) return undefined;
      const url = URL.createObjectURL(blob);
      this.urls.set(key, url);
      return url;
    })();
    this.pending.set(key, request);
    const forget = (): void => {
      if (this.pending.get(key) === request && !this.urls.has(key)) this.pending.delete(key);
    };
    request.then(forget, forget);
    return request;
  }

  revoke(id: string, path?: string): void {
    for (const key of [...this.pending.keys()]) {
      if (path === undefined ? !key.startsWith(`${id}/`) : key !== `${id}/${path}`) continue;
      this.pending.delete(key);
      const url = this.urls.get(key);
      if (url !== undefined) URL.revokeObjectURL(url);
      this.urls.delete(key);
    }
  }

  private async sumBytes(range?: IDBKeyRange): Promise<number> {
    const db = await this.db();
    const blobs = await requestDone(db.transaction(FILES).objectStore(FILES).getAll(range) as IDBRequest<Blob[]>);
    return blobs.reduce((sum, blob) => sum + blob.size, 0);
  }

  totalBytes(): Promise<number> {
    return this.sumBytes();
  }

  packBytes(id: string): Promise<number> {
    return this.sumBytes(packRange(id));
  }

  async markWithdrawn(id: string, withdrawn: boolean): Promise<void> {
    const db = await this.db();
    const tx = db.transaction(MANIFESTS, "readwrite");
    const done = transactionDone(tx);
    done.catch(() => {});
    const store = tx.objectStore(MANIFESTS);
    const current = (await requestDone(store.get(id))) as InstalledPack | undefined;
    if (current && current.withdrawn !== withdrawn) store.put({ ...current, withdrawn });
    await done;
  }

  /** Asks the browser not to evict the store, once, before the first install. Never awaited, never throws. */
  private askPersist(): void {
    if (this.persistAsked) return;
    this.persistAsked = true;
    try {
      if (typeof navigator !== "undefined" && typeof navigator.storage?.persist === "function") {
        navigator.storage.persist().catch(() => {});
      }
    } catch {
      // A refusal or an unsupported webview is fine.
    }
  }
}
