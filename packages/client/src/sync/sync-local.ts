/**
 * This device's save data as sync's logical records (`sync-types.ts` has the key scheme), and the way back: records
 * another device changed are written into the right store, and deletions removed.
 *
 * It reads and writes the same databases an export does (`SAVED_DATABASES`, plus the `mc-*` `localStorage` entries
 * except the per-device ones in `SYNC_EXCLUDED_KEYS`), generically: a store added to the spec list is picked up with
 * no change here, as one record per row under `db:<database>:<store>:<key>`. Only `mc-saves` is special, because a
 * game is too big for one record and its parts change at different rates: per game a `meta` record (the summary row
 * plus `logHash`, so two devices can compare logs without reading them), a `baseline`, and the command log in chunks
 * of `LOG_CHUNK` by seq, so a turn usually rewrites one chunk.
 *
 * A snapshot is cheap when little changed: per game it keeps the baseline and chunk records of the last read, keyed by
 * the meta's (updatedAt, commandCount, status), and re-reads a game's baseline and log only when that changed. The
 * cache lives in the instance (one session) and a game this instance wrote is dropped from it.
 *
 * Apply never writes the game being played (`openGameId`): its session holds the log in memory and would append over
 * it. The sync engine filters those out; asking for one here is a bug, so it throws rather than skipping. Apply is
 * atomic per database (a failed request aborts that database's transaction), not across databases.
 *
 * A store or database this build doesn't know (written by a newer build) is neither read nor written: records for it
 * are ignored on apply. The spec list, the factory and `localStorage` are injectable so tests run on `fake-indexeddb`.
 */
import {
  SAVED_DATABASES,
  SAVED_LOCAL_STORAGE_PREFIX,
  type DatabaseSpec,
  type StoreSpec,
} from "../save-data/databases.js";
import { committed, open, savedKeys, settle, type KeyValueStorage } from "../save-data/save-data.js";
import { LOG_CHUNK, type LocalSaveData, type LogicalRecord } from "./sync-types.js";

/**
 * The `mc-*` localStorage keys that describe this device, not the player: an export keeps them (a restore on the same
 * machine wants them) but sync neither sends nor applies them. Verdicts, by key:
 *  - `mc-settings`: window mode, resolution, power and volume choices; wrong on another screen.
 *  - `mc-break-time-start`: a running break timer of this session.
 *  - `mc-update-dismissed`: the release this install's update banner was dismissed for.
 *  - `mc-seats-recommended-collapsed`: a layout choice for this screen.
 * Synced on purpose: `mc-unlocks`, `mc-unlocked-everything`, `mc-guide`, `mc-deck-feats`, `mc-achievements-seen`,
 * `mc-rank-seen` and `mc-deck-freeze-optin:*` (progress, preferences about the player, and a campaign's choices).
 */
export const SYNC_EXCLUDED_KEYS: ReadonlySet<string> = new Set([
  "mc-settings",
  "mc-break-time-start",
  "mc-update-dismissed",
  "mc-seats-recommended-collapsed",
]);

export interface LocalSaveDataDeps {
  readonly indexedDB: IDBFactory;
  /** `null` where `localStorage` is missing: only the databases sync. */
  readonly localStorage: KeyValueStorage | null;
  readonly openGameId: () => string | null;
  /** The databases to map; defaults to `SAVED_DATABASES`. */
  readonly databases?: readonly DatabaseSpec[];
  /** Ids for `copyGame`; defaults to `crypto.randomUUID`. */
  readonly newId?: () => string;
}

const SAVES_DB = "mc-saves";
const GAME_STORES = new Set(["games", "baselines", "commands"]);

interface GameMeta {
  readonly id: string;
  readonly status?: string;
  readonly updatedAt?: number;
  readonly commandCount?: number;
  readonly campaignId?: string | null;
  readonly [field: string]: unknown;
}

interface CommandRow {
  readonly gameId: string;
  readonly seq: number;
  readonly command: unknown;
}

/** JSON with object keys sorted at every level, so equal values always serialize the same. */
export function canonicalJson(value: unknown): string {
  return JSON.stringify(value, (_key, v: unknown) => {
    if (v && typeof v === "object" && !Array.isArray(v)) {
      return Object.fromEntries(
        Object.entries(v as Record<string, unknown>).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)),
      );
    }
    return v;
  });
}

function base64url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/** SHA-256 of the canonical JSON of `value`, in unpadded base64url. */
export async function hashValue(value: unknown): Promise<string> {
  const bytes = new TextEncoder().encode(canonicalJson(value) ?? "null");
  return base64url(new Uint8Array(await crypto.subtle.digest("SHA-256", bytes)));
}

function pathValue(row: unknown, path: string): unknown {
  let at: unknown = row;
  for (const part of path.split(".")) {
    if (at === null || typeof at !== "object") return undefined;
    at = (at as Record<string, unknown>)[part];
  }
  return at;
}

/**
 * One key part as text, losslessly: a number is `#123`, and in a string "%" "/" and a leading "#" are percent-escaped,
 * so "/" can join a compound key's parts and a number never reads as a string (or the reverse).
 */
function encodePart(part: unknown): string {
  if (typeof part === "number") return `#${part}`;
  return String(part).replace(/%/g, "%25").replace(/\//g, "%2F").replace(/^#/, "%23");
}

function decodePart(text: string): string | number {
  if (text.startsWith("#")) return Number(text.slice(1));
  return text.replace(/%2F/g, "/").replace(/%23/g, "#").replace(/%25/g, "%");
}

/** A row's logical key part: its key path value, a compound key's parts joined with "/". */
function rowKey(store: StoreSpec, row: unknown): string {
  const paths = typeof store.keyPath === "string" ? [store.keyPath] : store.keyPath;
  return paths.map((path) => encodePart(pathValue(row, path))).join("/");
}

/** The IndexedDB key a logical key part names. */
function storeKey(store: StoreSpec, key: string): IDBValidKey {
  const parts = key.split("/").map(decodePart);
  return typeof store.keyPath === "string" ? parts[0]! : parts;
}

type GameKey =
  | { readonly id: string; readonly part: "meta" }
  | { readonly id: string; readonly part: "baseline" }
  | { readonly id: string; readonly part: "log"; readonly n: number };

function parseGameKey(key: string): GameKey | null {
  const match = /^game:(.+):(meta|baseline|log:(\d+))$/.exec(key);
  if (!match) return null;
  const id = match[1]!;
  if (match[2] === "meta") return { id, part: "meta" };
  if (match[2] === "baseline") return { id, part: "baseline" };
  return { id, part: "log", n: Number(match[3]) };
}

/** A key's `db:<database>:<store>:<key>` parts; the key may itself contain ":". */
function parseDbKey(key: string): { database: string; store: string; key: string } | null {
  const match = /^db:([^:]+):([^:]+):(.*)$/s.exec(key);
  return match ? { database: match[1]!, store: match[2]!, key: match[3]! } : null;
}

const chunkRange = (id: string, n: number): IDBKeyRange =>
  IDBKeyRange.bound([id, n * LOG_CHUNK], [id, (n + 1) * LOG_CHUNK], false, true);

const wholeLog = (id: string): IDBKeyRange => IDBKeyRange.bound([id, 0], [id, Infinity]);

/** The game a logical key belongs to, if it is a game key. */
function gameIdOf(key: string): string | null {
  return parseGameKey(key)?.id ?? null;
}

/** Whether a set of a game's records (as `copyGame` takes them) is a campaign game: "keep both" isn't offered for one. */
export function isCampaignGame(records: readonly { key: string; value: unknown }[]): boolean {
  const meta = records.find((record) => parseGameKey(record.key)?.part === "meta")?.value as GameMeta | undefined;
  return meta?.campaignId != null;
}

const isSavesSpec = (spec: DatabaseSpec): boolean =>
  spec.name === SAVES_DB && [...GAME_STORES].every((name) => spec.stores.some((s) => s.name === name));

interface GameCacheEntry {
  readonly sig: string;
  readonly logHash: string;
  readonly baseline: LogicalRecord | null;
  readonly chunks: readonly LogicalRecord[];
}

type Write = { readonly key: string; readonly value: unknown };

export class IdbLocalSaveData implements LocalSaveData {
  readonly #deps: LocalSaveDataDeps;
  readonly #specs: readonly DatabaseSpec[];
  readonly #cache = new Map<string, GameCacheEntry>();

  constructor(deps: LocalSaveDataDeps) {
    this.#deps = deps;
    this.#specs = deps.databases ?? SAVED_DATABASES;
  }

  openGameId(): string | null {
    return this.#deps.openGameId();
  }

  async snapshot(): Promise<readonly LogicalRecord[]> {
    const records: LogicalRecord[] = [];
    for (const spec of this.#specs) {
      const saves = isSavesSpec(spec);
      if (saves) records.push(...(await this.#gameRecords(spec)));
      const rows = await this.#readDatabase(spec, saves ? GAME_STORES : new Set());
      for (const store of spec.stores) {
        if (saves && GAME_STORES.has(store.name)) continue;
        for (const value of rows.get(store.name) ?? []) {
          const stamp = rowStamp(value);
          records.push({
            key: `db:${spec.name}:${store.name}:${rowKey(store, value)}`,
            value,
            hash: await hashValue(value),
            stamp,
          });
        }
      }
    }
    const storage = this.#deps.localStorage;
    if (storage) {
      for (const key of savedKeys(storage).sort()) {
        if (SYNC_EXCLUDED_KEYS.has(key)) continue;
        const value = storage.getItem(key);
        if (value !== null) records.push({ key: `ls:${key}`, value, hash: await hashValue(value), stamp: 0 });
      }
    }
    return records;
  }

  /** Every row of `spec`'s stores except `skip`, in one read transaction. */
  async #readDatabase(spec: DatabaseSpec, skip: ReadonlySet<string>): Promise<Map<string, unknown[]>> {
    const names = spec.stores.map((store) => store.name).filter((name) => !skip.has(name));
    if (names.length === 0) return new Map();
    const db = await open(this.#deps.indexedDB, spec);
    try {
      const transaction = db.transaction(names, "readonly");
      const done = committed(transaction);
      const all = await Promise.all(names.map((name) => settle(transaction.objectStore(name).getAll())));
      await done;
      return new Map(names.map((name, i) => [name, all[i] as unknown[]]));
    } finally {
      db.close();
    }
  }

  async #gameRecords(spec: DatabaseSpec): Promise<LogicalRecord[]> {
    const db = await open(this.#deps.indexedDB, spec);
    try {
      const listing = db.transaction("games", "readonly");
      const listed = committed(listing);
      const metas = await settle(listing.objectStore("games").getAll() as IDBRequest<GameMeta[]>);
      await listed;
      const records: LogicalRecord[] = [];
      const seen = new Set<string>();
      for (const listedMeta of metas.sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))) {
        const id = listedMeta.id;
        let meta = listedMeta;
        let entry = this.#cache.get(id);
        if (!entry || entry.sig !== sigOf(meta)) {
          // The meta is re-read with the log so the two agree even if a command landed since the listing.
          const reading = db.transaction(["games", "baselines", "commands"], "readonly");
          const read = committed(reading);
          const [fresh, baseline, rows] = await Promise.all([
            settle(reading.objectStore("games").get(id) as IDBRequest<GameMeta | undefined>),
            settle(reading.objectStore("baselines").get(id)),
            settle(reading.objectStore("commands").getAll(wholeLog(id)) as IDBRequest<CommandRow[]>),
          ]);
          await read;
          if (!fresh) continue;
          meta = fresh;
          entry = await buildEntry(meta, baseline, rows);
          this.#cache.set(id, entry);
        }
        seen.add(id);
        const value = { ...meta, logHash: entry.logHash };
        records.push({ key: `game:${id}:meta`, value, hash: await hashValue(value), stamp: stampOf(meta) });
        if (entry.baseline) records.push(entry.baseline);
        records.push(...entry.chunks);
      }
      for (const id of [...this.#cache.keys()]) if (!seen.has(id)) this.#cache.delete(id);
      return records;
    } finally {
      db.close();
    }
  }

  async apply(write: readonly Write[], deleted: readonly string[]): Promise<void> {
    const playing = this.#deps.openGameId();
    if (playing !== null) {
      for (const key of [...write.map((w) => w.key), ...deleted]) {
        if (gameIdOf(key) === playing)
          throw new Error(`sync must not write the game being played (${playing}): ${key}`);
      }
    }
    this.#validate(write, deleted);
    for (const key of [...write.map((w) => w.key), ...deleted]) {
      const id = gameIdOf(key);
      if (id !== null) this.#cache.delete(id);
    }
    for (const spec of this.#specs) await this.#writeDatabase(spec, write, deleted);
    const storage = this.#deps.localStorage;
    if (!storage) return;
    for (const key of deleted) if (key.startsWith("ls:")) storage.removeItem(key.slice(3));
    for (const { key, value } of write) {
      if (key.startsWith("ls:") && typeof value === "string") storage.setItem(key.slice(3), value);
    }
  }

  /** Rejects records that are malformed or aimed at something sync must not write, before anything is written. */
  #validate(write: readonly Write[], deleted: readonly string[]): void {
    const lsName = (key: string): string | null => (key.startsWith("ls:") ? key.slice(3) : null);
    for (const key of [...write.map((w) => w.key), ...deleted]) {
      const name = lsName(key);
      if (name !== null && (!name.startsWith(SAVED_LOCAL_STORAGE_PREFIX) || SYNC_EXCLUDED_KEYS.has(name))) {
        throw new Error(`sync does not carry the local setting ${name}`);
      }
      if (key.startsWith(`db:${SAVES_DB}:`)) throw new Error(`saved games sync as game records, not ${key}`);
    }
    for (const { key, value } of write) {
      const game = parseGameKey(key);
      if (!game) continue;
      const object = value as Record<string, unknown> | null;
      if (game.part === "meta" && object?.["id"] !== game.id) throw new Error(`${key}: the meta is for another game`);
      if (game.part === "baseline" && object?.["gameId"] !== game.id)
        throw new Error(`${key}: the baseline is for another game`);
      if (game.part === "log") {
        const commands = object?.["commands"];
        if (!Array.isArray(commands) || commands.length > LOG_CHUNK) throw new Error(`${key}: not a log chunk`);
      }
    }
  }

  /** One database's share of an apply, in one transaction. Records of stores this build doesn't have are ignored. */
  async #writeDatabase(spec: DatabaseSpec, write: readonly Write[], deleted: readonly string[]): Promise<void> {
    const saves = isSavesSpec(spec);
    const stores = new Map(spec.stores.map((store) => [store.name, store]));
    const mine = (key: string): { store: StoreSpec; key: string } | null => {
      const parsed = parseDbKey(key);
      const store = parsed && parsed.database === spec.name ? stores.get(parsed.store) : undefined;
      return parsed && store ? { store, key: parsed.key } : null;
    };
    const gameDeletes = saves ? deleted.map((key) => parseGameKey(key)).filter((k): k is GameKey => k !== null) : [];
    const gameWrites = saves
      ? write.flatMap((w) => {
          const parsed = parseGameKey(w.key);
          return parsed ? [{ parsed, value: w.value }] : [];
        })
      : [];
    const dbDeletes = deleted.flatMap((key) => {
      const found = mine(key);
      return found ? [found] : [];
    });
    const dbWrites = write.flatMap((w) => {
      const found = mine(w.key);
      return found ? [{ ...found, value: w.value }] : [];
    });
    if (!gameDeletes.length && !gameWrites.length && !dbDeletes.length && !dbWrites.length) return;

    const db = await open(this.#deps.indexedDB, spec);
    try {
      // The game may have been opened while the database was opening: look again, right before the transaction.
      const playing = this.#deps.openGameId();
      if (saves && playing !== null) {
        const touched = [...gameDeletes, ...gameWrites.map((w) => w.parsed)].some((k) => k.id === playing);
        if (touched) throw new Error(`sync must not write the game being played (${playing})`);
      }
      const transaction = db.transaction(
        spec.stores.map((store) => store.name),
        "readwrite",
      );
      const done = committed(transaction);
      try {
        // Deletions first, so a game removed and written in one apply ends up written.
        for (const { store, key } of dbDeletes) transaction.objectStore(store.name).delete(storeKey(store, key));
        await this.#writeGames(transaction, gameDeletes, gameWrites, playing);
        for (const { store, value } of dbWrites) transaction.objectStore(store.name).put(value);
      } catch (cause) {
        // One bad record undoes the database's whole share, so a retry starts from where this began.
        transaction.abort();
        await done.catch(() => undefined);
        throw cause;
      }
      await done;
    } finally {
      db.close();
    }
  }

  /** Game deletes and writes inside `transaction`; a written active meta demotes the older active games. */
  async #writeGames(
    transaction: IDBTransaction,
    deletes: readonly GameKey[],
    writes: readonly { parsed: GameKey; value: unknown }[],
    playing: string | null,
  ): Promise<void> {
    if (!deletes.length && !writes.length) return;
    const games = transaction.objectStore("games");
    const commands = transaction.objectStore("commands");
    for (const k of deletes) {
      if (k.part === "meta") {
        games.delete(k.id);
        transaction.objectStore("baselines").delete(k.id);
        commands.delete(wholeLog(k.id));
      } else if (k.part === "baseline") {
        transaction.objectStore("baselines").delete(k.id);
      } else {
        commands.delete(chunkRange(k.id, k.n));
      }
    }
    let newestActive: GameMeta | null = null;
    for (const { parsed, value } of writes) {
      if (parsed.part === "meta") {
        const { logHash: _logHash, ...meta } = value as GameMeta & { logHash?: string };
        games.put(meta);
        if (meta.status === "active" && (!newestActive || (meta.updatedAt ?? 0) > (newestActive.updatedAt ?? 0))) {
          newestActive = meta;
        }
      } else if (parsed.part === "baseline") {
        transaction.objectStore("baselines").put(value);
      } else {
        // The chunk is the whole range: rows past its end (a remote undo) go.
        commands.delete(chunkRange(parsed.id, parsed.n));
        (value as { commands: unknown[] }).commands.forEach((command, i) => {
          commands.put({ gameId: parsed.id, seq: parsed.n * LOG_CHUNK + i, command } satisfies CommandRow);
        });
      }
    }
    if (!newestActive) return;
    // One game in progress at a time (as `IdbGameStorage.create` keeps it): the older active ones are retired.
    const winner: GameMeta = newestActive;
    for (const other of await settle(games.getAll() as IDBRequest<GameMeta[]>)) {
      if (other.id === winner.id || other.id === playing || other.status !== "active") continue;
      if ((other.updatedAt ?? 0) < (winner.updatedAt ?? 0)) games.put({ ...other, status: "abandoned" });
    }
  }

  async copyGame(records: readonly Write[]): Promise<string> {
    if (isCampaignGame(records)) throw new Error("a campaign game can't be kept as a second copy");
    const spec = this.#specs.find(isSavesSpec);
    if (!spec) throw new Error("no saved-games database to copy into");
    const id = (this.#deps.newId ?? (() => crypto.randomUUID()))();
    const db = await open(this.#deps.indexedDB, spec);
    try {
      const transaction = db.transaction(["games", "baselines", "commands"], "readwrite");
      const done = committed(transaction);
      try {
        // Read and write in one transaction, so the "another game is active" check can't go stale.
        const anotherActive = (await settle(transaction.objectStore("games").getAll() as IDBRequest<GameMeta[]>)).some(
          (game) => game.status === "active",
        );
        const renamed: { parsed: GameKey; value: unknown }[] = [];
        for (const { key, value } of records) {
          const parsed = parseGameKey(key);
          if (!parsed) continue;
          if (parsed.part === "meta") {
            const meta = value as GameMeta;
            const status = anotherActive && meta.status === "active" ? "abandoned" : meta.status;
            renamed.push({ parsed: { id, part: "meta" }, value: { ...meta, id, status } });
          } else if (parsed.part === "baseline") {
            renamed.push({ parsed: { id, part: "baseline" }, value: { ...(value as object), gameId: id } });
          } else {
            renamed.push({ parsed: { id, part: "log", n: parsed.n }, value });
          }
        }
        if (!renamed.some((r) => r.parsed.part === "meta")) throw new Error("the records to copy have no game meta");
        // `playing` is null: the copy is a new game, never the open one, and must not demote anything (it was
        // made abandoned above if another game is active).
        await this.#writeGames(transaction, [], renamed, null);
      } catch (cause) {
        transaction.abort();
        await done.catch(() => undefined);
        throw cause;
      }
      await done;
    } finally {
      db.close();
    }
    return id;
  }
}

/**
 * A row's own last-change time for last-write-wins: its `updatedAt` as epoch milliseconds, whether stored as a number
 * or as an ISO date string (decks keep one); 0 when it has none or it can't be read.
 */
export function rowStamp(row: unknown): number {
  const at = (row as { updatedAt?: unknown } | null)?.updatedAt;
  if (typeof at === "number") return Number.isFinite(at) ? at : 0;
  if (typeof at === "string") {
    const parsed = Date.parse(at);
    return Number.isNaN(parsed) ? 0 : parsed;
  }
  return 0;
}

const sigOf = (meta: GameMeta): string => `${meta.updatedAt}|${meta.commandCount}|${meta.status}`;
const stampOf = (meta: GameMeta): number => (typeof meta.updatedAt === "number" ? meta.updatedAt : 0);

/** The baseline and chunk records of a game read now, and the log hash derived from the chunk hashes. */
async function buildEntry(meta: GameMeta, baseline: unknown, rows: CommandRow[]): Promise<GameCacheEntry> {
  const id = meta.id;
  const stamp = stampOf(meta);
  const byChunk = new Map<number, unknown[]>();
  for (const row of rows.sort((a, b) => a.seq - b.seq)) {
    const n = Math.floor(row.seq / LOG_CHUNK);
    const chunk = byChunk.get(n) ?? [];
    chunk.push(row.command);
    byChunk.set(n, chunk);
  }
  const chunks: LogicalRecord[] = [];
  for (const [n, commands] of byChunk) {
    const value = { commands };
    chunks.push({ key: `game:${id}:log:${n}`, value, hash: await hashValue(value), stamp });
  }
  const logHash = await hashValue(chunks.map((chunk) => [chunk.key, chunk.hash]));
  const baselineRecord =
    baseline === undefined
      ? null
      : { key: `game:${id}:baseline`, value: baseline, hash: await hashValue(baseline), stamp };
  return { sig: sigOf(meta), logHash, baseline: baselineRecord, chunks };
}
