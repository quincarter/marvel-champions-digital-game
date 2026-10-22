/**
 * The device-sync engine (issue #276, step 2): one `sync()` pulls what other devices changed, merges it with what this
 * device changed, applies the remote side locally and pushes the local side, through `sync-api.ts`.
 *
 * Per logical key, "changed locally" means the hash differs from the last-synced entry (or the key is new, or it was
 * synced and is now gone: a delete); "changed remotely" means a pulled record newer than the entry's version.
 *
 *  - Plain keys (`db:`, `ls:`): one side changed, take it; both, the later stamp wins (a tie keeps this device's); an
 *    edit beats a delete, so nothing is lost to a delete.
 *  - A game (all `game:<id>:*` keys) is merged as a whole. The game open on this device is never written (it waits for
 *    the next sync). One side changed, take it. Both: when one side's command log extends the other's (chunk by chunk,
 *    with the other side's chunks unchanged where it didn't touch them) the longer wins; otherwise it has diverged
 *    and the player chooses, through `resolveConflict`: keep this device's, keep the other's, or keep both.
 *
 * Last-write-wins trusts the devices' clocks (accepted). A space that was wiped is refilled from this device on its
 * next sync (intended: local data is the source of truth).
 *
 * Every successful step is saved before the next (applied records and pushed records as entries, the cursor once a
 * round has pushed cleanly), so a run cut short resumes: anything not yet recorded is simply seen again, and a record
 * equal on both sides is adopted without any write. The cursor never moves past a remote record that is still waiting
 * (the open game, a conflict not yet decided), so the next run pulls it again.
 */
import { MAX_BATCH_BYTES, MAX_BATCH_OPS, MAX_RECORD_BYTES, type SyncOp } from "@mc/sync-worker/sync-protocol";
import { SAVED_DATABASES } from "../save-data/databases.js";
import { batch, changes, createSpace, type SyncFailure, type SyncResult } from "./sync-api.js";
import type { SyncCredentials } from "./sync-credentials.js";
import { CLIENT_VERSION } from "../version.js";
import { SYNC_EXCLUDED_KEYS, canonicalJson, hashValue } from "./sync-local.js";
import { DEFAULT_MERGERS } from "./sync-merge.js";
import { openRecord, recordKeyOf, sealRecord } from "./sync-records.js";
import type {
  ConflictChoice,
  GameConflict,
  LocalSaveData,
  LogicalRecord,
  SyncedEntry,
  SyncStateStore,
} from "./sync-types.js";
import type { SpaceInfo, SyncBatchResult, SyncChanges } from "@mc/sync-worker/sync-protocol";

/** Pull-merge-push rounds in one run; a push that keeps losing races after this many stops with "retry-later". */
export const MAX_SYNC_ROUNDS = 3;

export interface SyncEngineApi {
  readonly changes: (creds: SyncCredentials, since: number) => Promise<SyncResult<{ readonly changes: SyncChanges }>>;
  readonly batch: (
    creds: SyncCredentials,
    ops: readonly SyncOp[],
  ) => Promise<SyncResult<{ readonly result: SyncBatchResult }>>;
  readonly createSpace: (
    creds: SyncCredentials,
  ) => Promise<SyncResult<{ readonly info: SpaceInfo; readonly created: boolean }>>;
}

export const defaultSyncApi: SyncEngineApi = {
  changes: (creds, since) => changes(creds, since),
  batch: (creds, ops) => batch(creds, ops),
  createSpace: (creds) => createSpace(creds),
};

export interface SyncEngineDeps {
  readonly credentials: SyncCredentials;
  readonly local: LocalSaveData;
  readonly state: SyncStateStore;
  /** Asked when both devices changed a game and neither log extends the other. */
  readonly resolveConflict: (conflict: GameConflict) => Promise<ConflictChoice>;
  readonly api?: SyncEngineApi;
  readonly now?: () => number;
  /** The game's name for the prompt, from its meta record; the game id when this returns null or is absent. */
  readonly describeGame?: (meta: unknown) => string | null;
  /**
   * `mc-*` localStorage keys (with or without the `ls:` prefix) that stay on this device: never pushed, never applied,
   * and their absence is never a delete. Defaults to `SYNC_EXCLUDED_KEYS`.
   */
  readonly excludedLocalKeys?: ReadonlySet<string>;
  /**
   * Whether this build holds the store a `db:` key names; a record from a newer build's store is neither applied nor
   * missed (its absence from the snapshot is not a delete). Defaults to the stores in `SAVED_DATABASES`.
   */
  readonly knowsStore?: (database: string, store: string) => boolean;
  /**
   * Records that merge when both devices changed them, by logical key (default: `mc-unlocks`, `DEFAULT_MERGERS`): given
   * the local and remote values, the value both devices should end with.
   */
  readonly mergers?: Readonly<Record<string, (local: unknown, remote: unknown) => string>>;
  /** The build running now; records parked as unreadable are fetched again once when it changes. */
  readonly clientVersion?: string;
}

export interface SyncCounts {
  /** Records downloaded. */
  readonly pulled: number;
  /** Records written to or deleted from this device. */
  readonly applied: number;
  /** Records written to the server (the run's write budget). */
  readonly pushed: number;
  /** Games the player was asked about. */
  readonly conflicts: number;
  /** Records that wouldn't open or were too big to upload, left alone. */
  readonly skipped: number;
  /** Games left for the next sync (the open one, or a conflict on it). */
  readonly waiting: number;
}

export type SyncRunFailure =
  | SyncFailure
  /** Other devices kept writing; nothing is lost, try again soon. */
  | { readonly kind: "retry-later" }
  /** A local storage or crypto error. */
  | { readonly kind: "error"; readonly message: string };

export type SyncRunResult =
  | ({ readonly ok: true } & SyncCounts)
  | ({ readonly ok: false; readonly failure: SyncRunFailure } & SyncCounts);

/** A parked record's entry key: a record this build can't use yet, remembered so the cursor can pass it. */
const PARK_PREFIX = "~parked:";

const GAME_KEY = /^game:(.+):(meta|baseline|log:\d+)$/;
const gameIdOf = (key: string): string | null => GAME_KEY.exec(key)?.[1] ?? null;
const partOf = (key: string): "meta" | "baseline" | "log" | null => {
  const part = GAME_KEY.exec(key)?.[2];
  return part === undefined ? null : part === "meta" ? "meta" : part === "baseline" ? "baseline" : "log";
};
const logNumber = (key: string): number => Number(/:log:(\d+)$/.exec(key)?.[1] ?? 0);

interface Pulled {
  readonly recordKey: string;
  readonly version: number;
  readonly deleted: boolean;
  /** Null for a tombstone, which carries no name. */
  readonly key: string | null;
  readonly stamp: number;
  readonly value: unknown;
  readonly hash: string;
}

interface KeyState {
  readonly key: string;
  readonly recordKey: string;
  readonly local: LogicalRecord | undefined;
  readonly entry: SyncedEntry | undefined;
  readonly remote: Pulled | undefined;
  readonly localChanged: boolean;
  /** The local record carries no stamp of its own (and none was kept from an earlier sync). */
  readonly stampless: boolean;
}

interface PushItem {
  readonly key: string;
  readonly recordKey: string;
  readonly baseVersion: number;
  /** Undefined means delete. */
  readonly record: LogicalRecord | undefined;
}

interface Apply {
  readonly writes: { key: string; value: unknown }[];
  readonly deletes: string[];
  readonly entries: SyncedEntry[];
}

const newApply = (): Apply => ({ writes: [], deletes: [], entries: [] });

function commandsOf(value: unknown): unknown[] {
  const commands = (value as { commands?: unknown } | null)?.commands;
  return Array.isArray(commands) ? commands : [];
}

function isPrefix(shorter: readonly unknown[], longer: readonly unknown[]): boolean {
  return shorter.length <= longer.length && shorter.every((c, i) => canonicalJson(c) === canonicalJson(longer[i]));
}

const num = (value: unknown): number => (typeof value === "number" ? value : 0);

export class SyncEngine {
  readonly #deps: SyncEngineDeps;
  #running: Promise<SyncRunResult> | null = null;

  constructor(deps: SyncEngineDeps) {
    this.#deps = deps;
  }

  /** Runs one sync; a call while one is running joins it. */
  sync(): Promise<SyncRunResult> {
    this.#running ??= new Run(this.#deps).execute().finally(() => {
      this.#running = null;
    });
    return this.#running;
  }
}

class Run {
  readonly #d: SyncEngineDeps;
  readonly #api: SyncEngineApi;
  readonly #now: () => number;
  readonly #creds: SyncCredentials;
  readonly #counts = { pulled: 0, applied: 0, pushed: 0, conflicts: 0, skipped: 0, waiting: 0 };
  #entries = new Map<string, SyncedEntry>();
  /** Latest pulled record per record key, kept until the run ends so a later round still sees what is unresolved. */
  readonly #remote = new Map<string, Pulled>();
  readonly #recordKeys = new Map<string, string>();
  /** The answer to a conflict, with the version of the remote meta it was given for (a newer remote asks again). */
  readonly #choices = new Map<string, { choice: ConflictChoice; remoteMetaVersion: number }>();
  /** Games already copied for "keep both", with the remote meta version copied. */
  readonly #copied = new Map<string, number>();
  /**
   * Records this build could not use (they would not open, or belong to a store it lacks), by record key. They are kept
   * in the sync state as entries named `~parked:<recordKey>` so the cursor can move past them; their key is left alone
   * while they sit newer than what this device knows, and they are fetched again once when the build changes.
   */
  readonly #parked = new Map<string, { version: number; build: string }>();
  #refetchFrom: number | null = null;
  #fullState: Map<string, { version: number; deleted: boolean; data?: string | undefined }> | null = null;
  readonly #fullGames = new Map<string, Map<string, Pulled>>();
  #cursor = 0;
  /** The space's creation time as last seen; a page that says otherwise means the space was recreated. */
  #epoch: number | null = null;
  #reset = false;
  /** The cursor must not be saved past this: a remote record before it is still waiting. */
  #hold = Infinity;

  constructor(deps: SyncEngineDeps) {
    this.#d = deps;
    this.#api = deps.api ?? defaultSyncApi;
    this.#now = deps.now ?? Date.now;
    this.#creds = deps.credentials;
  }

  #result(failure?: SyncRunFailure): SyncRunResult {
    return failure ? { ok: false, failure, ...this.#counts } : { ok: true, ...this.#counts };
  }

  async execute(): Promise<SyncRunResult> {
    try {
      return await this.#execute();
    } catch (error) {
      return this.#result({ kind: "error", message: error instanceof Error ? error.message : String(error) });
    }
  }

  async #execute(): Promise<SyncRunResult> {
    const { state } = this.#d;
    const spaceId = this.#creds.spaceId;
    let meta = await state.meta();
    if (meta.spaceId !== spaceId) {
      // A new or different space: nothing this device remembers about versions applies to it.
      await state.clear();
      const created = await this.#api.createSpace(this.#creds);
      if (!created.ok) return this.#result(created.failure);
      meta = { cursor: 0, lastSyncedAt: null, spaceId, epoch: null };
      await state.setMeta(meta);
    }
    this.#entries = new Map(await state.entries());
    this.#cursor = meta.cursor;
    this.#epoch = meta.epoch ?? null;
    this.#parked.clear();
    for (const entry of this.#entries.values()) {
      if (entry.key.startsWith(PARK_PREFIX) && !entry.deleted) {
        this.#parked.set(entry.recordKey, { version: entry.version, build: entry.hash });
      }
    }
    // A different build may read what the last one could not: pull again from the lowest such record, once.
    const stale = [...this.#parked.values()].filter((p) => p.build !== this.#build);
    this.#refetchFrom = stale.length ? Math.max(0, Math.min(...stale.map((p) => p.version)) - 1) : null;

    for (let round = 1; round <= MAX_SYNC_ROUNDS; round++) {
      this.#fullState = null;
      this.#fullGames.clear();
      const pulled = await this.#pullAll();
      if (pulled) return this.#result(pulled);
      const plan = await this.#reconcile();
      const pushed = await this.#push(plan.pushes);
      if ("failure" in pushed) return this.#result(pushed.failure);
      if (pushed.conflicts > 0) {
        // Another device wrote the same records first: pull again and redo the merge for them.
        if (round === MAX_SYNC_ROUNDS) return this.#result({ kind: "retry-later" });
        continue;
      }
      await state.setMeta({
        cursor: Math.min(this.#cursor, this.#hold),
        lastSyncedAt: this.#now(),
        spaceId,
        epoch: this.#epoch,
      });
      // A copy made for "keep both" is a new local game still to upload.
      if (!plan.copied || round === MAX_SYNC_ROUNDS) return this.#result();
    }
    return this.#result({ kind: "retry-later" });
  }

  // ---- pull ----------------------------------------------------------------------------------------------------

  async #pullAll(): Promise<SyncRunFailure | null> {
    let since = Math.min(this.#cursor, this.#refetchFrom ?? this.#cursor);
    this.#refetchFrom = null;
    for (;;) {
      const got = await this.#api.changes(this.#creds, since);
      if (!got.ok) return got.failure;
      const page = got.changes;
      const { epoch } = page;
      if (this.#epoch !== null && epoch !== this.#epoch) {
        if (this.#reset) return { kind: "unavailable" };
        // The space was wiped or recreated: what this device remembers of it is void. Local data stays and is
        // pushed again from cursor 0.
        this.#reset = true;
        await this.#d.state.clear();
        await this.#d.state.setMeta({ cursor: 0, lastSyncedAt: null, spaceId: this.#creds.spaceId, epoch });
        this.#entries = new Map();
        this.#remote.clear();
        this.#fullState = null;
        this.#fullGames.clear();
        this.#cursor = 0;
        this.#parked.clear();
        since = 0;
        this.#epoch = epoch;
        this.#hold = Infinity;
        continue;
      }
      this.#epoch = epoch;
      for (const record of page.records) {
        this.#counts.pulled++;
        const known = this.#remote.get(record.key);
        if (known && known.version >= record.version) continue;
        if (record.deleted || record.data === undefined) {
          await this.#unpark(record.key); // a delete settles whatever could not be read before it
          this.#remote.set(record.key, {
            recordKey: record.key,
            version: record.version,
            deleted: true,
            key: null,
            stamp: 0,
            value: null,
            hash: "",
          });
          continue;
        }
        try {
          const opened = await openRecord(this.#creds, record.key, record.data);
          this.#remote.set(record.key, {
            recordKey: record.key,
            version: record.version,
            deleted: false,
            key: opened.key,
            stamp: opened.stamp,
            value: opened.value,
            hash: await hashValue(opened.value),
          });
          await this.#unpark(record.key);
        } catch {
          // Never applied. Parked, so the cursor can pass it and the key it belongs to is left alone until a build
          // that can read it fetches it again.
          this.#counts.skipped++;
          this.#remote.delete(record.key);
          await this.#park(record.key, record.version);
        }
      }
      if (page.more && page.cursor <= since) return { kind: "unavailable" };
      since = page.cursor;
      this.#cursor = Math.max(this.#cursor, page.cursor);
      if (!page.more) return null;
    }
  }

  get #build(): string {
    return this.#d.clientVersion ?? CLIENT_VERSION;
  }

  async #park(recordKey: string, version: number): Promise<void> {
    const known = this.#parked.get(recordKey);
    if (known && known.version === version && known.build === this.#build) return;
    this.#parked.set(recordKey, { version, build: this.#build });
    await this.#commit([
      { key: PARK_PREFIX + recordKey, recordKey, version, hash: this.#build, stamp: 0, deleted: false },
    ]);
  }

  async #unpark(recordKey: string): Promise<void> {
    if (!this.#parked.delete(recordKey)) return;
    await this.#commit([{ key: PARK_PREFIX + recordKey, recordKey, version: 0, hash: "", stamp: 0, deleted: true }]);
  }

  // ---- which keys are ours ---------------------------------------------------------------------------------------

  #isSynced(key: string): boolean {
    if (key.startsWith("ls:")) {
      const excluded = this.#d.excludedLocalKeys ?? SYNC_EXCLUDED_KEYS;
      return !(excluded && (excluded.has(key) || excluded.has(key.slice(3))));
    }
    const db = /^db:([^:]+):([^:]+):/.exec(key);
    if (db) {
      const knows = this.#d.knowsStore ?? ((database, store) => knowsSavedStore(database, store));
      return knows(db[1]!, db[2]!);
    }
    return gameIdOf(key) !== null;
  }

  async #recordKey(key: string): Promise<string> {
    let recordKey = this.#recordKeys.get(key);
    if (recordKey === undefined) {
      recordKey = await recordKeyOf(this.#creds, key);
      this.#recordKeys.set(key, recordKey);
    }
    return recordKey;
  }

  // ---- reconcile -------------------------------------------------------------------------------------------------

  async #reconcile(): Promise<{ pushes: PushItem[]; copied: boolean }> {
    const now = this.#now();
    const locals = new Map<string, LogicalRecord>();
    const stampless = new Set<string>();
    for (const record of await this.#d.local.snapshot()) {
      if (!this.#isSynced(record.key)) continue;
      const entry = this.#entries.get(record.key);
      if (record.stamp <= 0 && !(entry && !entry.deleted && entry.hash === record.hash)) stampless.add(record.key);
      const stamp =
        record.stamp > 0 ? record.stamp : entry && !entry.deleted && entry.hash === record.hash ? entry.stamp : now;
      locals.set(record.key, { ...record, stamp });
    }
    const nameOf = new Map<string, string>();
    for (const entry of this.#entries.values()) nameOf.set(entry.recordKey, entry.key);
    for (const key of locals.keys()) nameOf.set(await this.#recordKey(key), key);

    const blocked = new Set<string>();
    for (const [recordKey, { version }] of this.#parked) {
      const key = nameOf.get(recordKey);
      if (key !== undefined && version > (this.#entries.get(key)?.version ?? 0)) blocked.add(key);
    }
    const remoteByKey = new Map<string, Pulled>();
    for (const pulled of this.#remote.values()) {
      const key = pulled.key ?? nameOf.get(pulled.recordKey);
      if (key === undefined) continue;
      if (!this.#isSynced(key)) {
        // A store this build lacks (a newer build's): not applied, and not passed by the cursor either.
        if (key.startsWith("db:")) await this.#park(pulled.recordKey, pulled.version);
        continue;
      }
      if (pulled.version <= (this.#entries.get(key)?.version ?? 0)) continue;
      remoteByKey.set(key, pulled);
    }

    const keys = new Set<string>(locals.keys());
    for (const key of this.#entries.keys()) if (this.#isSynced(key)) keys.add(key);
    for (const key of remoteByKey.keys()) keys.add(key);

    const adopted: SyncedEntry[] = [];
    const states = new Map<string, KeyState>();
    for (const key of [...keys].sort()) {
      const local = locals.get(key);
      let entry = this.#entries.get(key);
      let remote = remoteByKey.get(key);
      const recordKey = remote?.recordKey ?? entry?.recordKey ?? (await this.#recordKey(key));
      if (remote && (remote.deleted ? !local : local !== undefined && !remote.deleted && local.hash === remote.hash)) {
        // Equal on both sides (typically our own earlier push, seen again): just remember its version.
        entry = {
          key,
          recordKey,
          version: remote.version,
          hash: remote.deleted ? "" : remote.hash,
          stamp: remote.deleted ? 0 : Math.max(remote.stamp, local?.stamp ?? 0),
          deleted: remote.deleted,
        };
        adopted.push(entry);
        remote = undefined;
      }
      const localChanged = local
        ? !entry || entry.deleted || entry.hash !== local.hash
        : entry !== undefined && !entry.deleted;
      states.set(key, { key, recordKey, local, entry, remote, localChanged, stampless: stampless.has(key) });
    }
    if (adopted.length) await this.#commit(adopted);

    const pushes: PushItem[] = [];
    const plain = newApply();
    const games = new Map<string, KeyState[]>();
    for (const state of states.values()) {
      const gameId = gameIdOf(state.key);
      if (gameId !== null) {
        const list = games.get(gameId) ?? [];
        list.push(state);
        games.set(gameId, list);
      } else if (blocked.has(state.key)) {
        this.#counts.waiting++;
      } else {
        await this.#planPlain(state, plain, pushes);
      }
    }
    await this.#applyAndCommit(plain);

    let copied = false;
    const open = this.#d.local.openGameId();
    for (const [gameId, list] of games) {
      if (list.some((s) => blocked.has(s.key))) {
        this.#defer(list);
        continue;
      }
      const apply = newApply();
      const didCopy = await this.#planGame(gameId, list, gameId === open, apply, pushes);
      copied ||= didCopy;
      await this.#applyAndCommit(apply);
    }
    return { pushes, copied };
  }

  #base(state: KeyState): number {
    return state.remote?.version ?? state.entry?.version ?? 0;
  }

  #pushOf(state: KeyState, pushes: PushItem[]): void {
    pushes.push({ key: state.key, recordKey: state.recordKey, baseVersion: this.#base(state), record: state.local });
  }

  #applyOf(state: KeyState, into: Apply): void {
    const remote = state.remote!;
    if (remote.deleted) {
      into.deletes.push(state.key);
      into.entries.push({
        key: state.key,
        recordKey: state.recordKey,
        version: remote.version,
        hash: "",
        stamp: 0,
        deleted: true,
      });
    } else {
      into.writes.push({ key: state.key, value: remote.value });
      into.entries.push({
        key: state.key,
        recordKey: state.recordKey,
        version: remote.version,
        hash: remote.hash,
        stamp: remote.stamp,
        deleted: false,
      });
    }
  }

  async #planPlain(state: KeyState, apply: Apply, pushes: PushItem[]): Promise<void> {
    const { remote, local } = state;
    if (!remote) {
      if (state.localChanged) this.#pushOf(state, pushes);
      return;
    }
    if (!state.localChanged) return this.#applyOf(state, apply);
    // Both changed. An edit beats a delete; otherwise the later stamp wins and a tie keeps this device's.
    if (!local) return this.#applyOf(state, apply);
    const merge = (this.#d.mergers ?? DEFAULT_MERGERS)[state.key];
    if (merge && !remote.deleted) {
      // Both devices changed a record that merges (unlock picks): neither side wins, the merged value is both's.
      const merged = merge(local.value, remote.value);
      if (merged === remote.value) return this.#applyOf(state, apply);
      if (merged === local.value) return this.#pushOf(state, pushes);
      apply.writes.push({ key: state.key, value: merged });
      pushes.push({
        key: state.key,
        recordKey: state.recordKey,
        baseVersion: remote.version,
        record: { key: state.key, value: merged, hash: await hashValue(merged), stamp: this.#now() },
      });
      return;
    }
    // No stamp history on this side (a first join, a new space): the cloud's copy wins over this device's defaults.
    if (!remote.deleted && !state.entry && state.stampless) return this.#applyOf(state, apply);
    if (remote.deleted || local.stamp >= remote.stamp) return this.#pushOf(state, pushes);
    this.#applyOf(state, apply);
  }

  async #applyAndCommit(apply: Apply): Promise<void> {
    if (!apply.writes.length && !apply.deletes.length) return;
    // If this throws, no entry is recorded: the next run sees the same remote records again.
    await this.#d.local.apply(apply.writes, apply.deletes);
    this.#counts.applied += apply.writes.length + apply.deletes.length;
    await this.#commit(apply.entries);
  }

  async #commit(entries: readonly SyncedEntry[]): Promise<void> {
    if (!entries.length) return;
    await this.#d.state.putEntries(entries);
    for (const entry of entries) this.#entries.set(entry.key, entry);
  }

  // ---- games -----------------------------------------------------------------------------------------------------

  #defer(list: readonly KeyState[]): void {
    this.#counts.waiting++;
    for (const state of list) if (state.remote) this.#hold = Math.min(this.#hold, state.remote.version - 1);
  }

  /** Returns whether it copied a game (the copy still has to be pushed). */
  async #planGame(
    gameId: string,
    list: readonly KeyState[],
    isOpen: boolean,
    apply: Apply,
    pushes: PushItem[],
  ): Promise<boolean> {
    const localChanged = list.some((s) => s.localChanged);
    const remoteChanged = list.some((s) => s.remote);
    if (isOpen) {
      // Its session holds the log in memory; leave the remote side for the next sync.
      if (remoteChanged) this.#defer(list);
      else for (const s of list) if (s.localChanged) this.#pushOf(s, pushes);
      return false;
    }
    if (!remoteChanged) {
      for (const s of list) if (s.localChanged) this.#pushOf(s, pushes);
      return false;
    }
    if (!localChanged) {
      const metaState = list.find((s) => partOf(s.key) === "meta");
      const metaAfter = metaState?.remote ? !metaState.remote.deleted : metaState?.local !== undefined;
      const writesGame = list.some((s) => s.remote && !s.remote.deleted);
      // Half a push seen mid-way (chunks without their meta, or a log the meta doesn't describe): wait for the rest.
      if (writesGame && (!metaAfter || !(await this.#consistent(list)))) return this.#deferred(list);
      for (const s of list) if (s.remote) this.#applyOf(s, apply);
      return false;
    }

    let verdict = this.#analyse(list);
    if (verdict !== "diverged" && this.#firstContactDiffers(list)) verdict = "diverged";
    if (verdict === "local") {
      this.#localOverRemote(list, pushes);
      return false;
    }
    if (verdict === "remote") {
      if (!(await this.#consistent(list))) return this.#deferred(list);
      for (const s of list) if (s.remote) this.#applyOf(s, apply);
      return false;
    }

    const full = await this.#fullGame(gameId, list);
    // A record of it won't open here, or the server holds half a push (a log its meta doesn't describe): wait.
    if (full === null || !(await this.#fullConsistent(full))) return this.#deferred(list);
    const localMeta = list.find((s) => partOf(s.key) === "meta")?.local;
    const remoteMeta = full.get(`game:${gameId}:meta`);
    if (!localMeta && remoteMeta && !remoteMeta.deleted) {
      // Deleted here, played on there: the whole remote game comes back (an edit beats a delete), not just the
      // records this run pulled, or the next push would tombstone the rest.
      this.#remoteOverLocal(list, full, apply);
      return false;
    }
    if (!localMeta || !remoteMeta || remoteMeta.deleted) {
      // One side has no game record to show: nothing to ask, the side that has one wins (an edit beats a delete).
      if (localMeta) this.#localOverRemote(list, pushes);
      else for (const s of list) if (s.remote) this.#applyOf(s, apply);
      return false;
    }
    let choice = this.#choices.get(gameId)?.choice;
    if (this.#choices.get(gameId)?.remoteMetaVersion !== remoteMeta.version) choice = undefined;
    if (choice === undefined) {
      const metaOf = (v: unknown) => (v ?? {}) as { round?: unknown; updatedAt?: unknown; campaignId?: unknown };
      const l = metaOf(localMeta.value);
      const r = metaOf(remoteMeta.value);
      this.#counts.conflicts++;
      choice = await this.#d.resolveConflict({
        gameId,
        local: { round: num(l.round), updatedAt: num(l.updatedAt) },
        remote: { round: num(r.round), updatedAt: num(r.updatedAt) },
        label: this.#d.describeGame?.(localMeta.value) ?? gameId,
        campaign: Boolean(l.campaignId ?? r.campaignId),
      });
      this.#choices.set(gameId, { choice, remoteMetaVersion: remoteMeta.version });
    }
    if (choice === "keep-local") {
      this.#localOverRemote(list, pushes);
      return false;
    }
    if (choice === "keep-remote") {
      this.#remoteOverLocal(list, full, apply);
      return false;
    }
    if (choice !== "keep-both") throw new Error(`unknown conflict choice: ${String(choice)}`);
    const campaignGame = Boolean(
      (localMeta.value as { campaignId?: unknown })?.campaignId ??
      (remoteMeta.value as { campaignId?: unknown })?.campaignId,
    );
    if (campaignGame) throw new Error("keep-both was chosen for a campaign game, which cannot be copied");
    let copied = false;
    if (this.#copied.get(gameId) !== remoteMeta.version) {
      const records = [...full.values()]
        .filter((p) => !p.deleted && p.key !== null)
        .map((p) => ({ key: p.key!, value: p.value }));
      await this.#d.local.copyGame(records);
      this.#copied.set(gameId, remoteMeta.version);
      copied = true;
      // Remember the remote game as what this device last synced, so a run cut short before the push doesn't copy
      // (and ask) again (if the remote changes meanwhile it can copy a second time, which is acceptable): the next run sees only this device's changes and pushes them.
      await this.#commit(
        [...full.values()].map((p) => ({
          key: p.key ?? "",
          recordKey: p.recordKey,
          version: p.version,
          hash: p.deleted ? "" : p.hash,
          stamp: p.deleted ? 0 : p.stamp,
          deleted: p.deleted,
        })),
      );
    }
    this.#localOverRemote(this.#rebased(list, full), pushes);
    return copied;
  }

  /** The game's key states as they are once its remote records are this device's last-synced entries. */
  #rebased(list: readonly KeyState[], full: ReadonlyMap<string, Pulled>): KeyState[] {
    return list.map((s) => {
      const entry = this.#entries.get(s.key);
      const localChanged = s.local
        ? !entry || entry.deleted || entry.hash !== s.local.hash
        : entry !== undefined && !entry.deleted;
      return { ...s, entry, remote: undefined, localChanged, recordKey: full.get(s.key)?.recordKey ?? s.recordKey };
    });
  }

  /** Whether the server's whole game (read in full) is consistent: its log is the one its meta describes. */
  async #fullConsistent(full: ReadonlyMap<string, Pulled>): Promise<boolean> {
    let meta: Pulled | undefined;
    const chunks: { n: number; key: string; hash: string }[] = [];
    for (const [key, p] of full) {
      if (p.deleted) continue;
      if (partOf(key) === "meta") meta = p;
      else if (partOf(key) === "log") chunks.push({ n: logNumber(key), key, hash: p.hash });
    }
    return meta === undefined || (await this.#logMatches(meta.value, chunks));
  }

  async #logMatches(metaValue: unknown, chunks: { n: number; key: string; hash: string }[]): Promise<boolean> {
    const logHash = (metaValue as { logHash?: unknown } | null)?.logHash;
    if (typeof logHash !== "string") return true;
    chunks.sort((a, b) => a.n - b.n);
    // The same derivation as sync-local's `logHash`: a hash over each chunk's key and hash, in chunk order.
    return (await hashValue(chunks.map((c) => [c.key, c.hash]))) === logHash;
  }

  /** Whether the log the remote records assemble to is the one the remote meta describes. */
  async #consistent(list: readonly KeyState[]): Promise<boolean> {
    const meta = list.find((s) => partOf(s.key) === "meta")?.remote;
    if (!meta || meta.deleted) return true;
    const chunks: { n: number; key: string; hash: string }[] = [];
    for (const s of list) {
      if (partOf(s.key) !== "log") continue;
      const source = s.remote ?? s.local;
      if (source && !("deleted" in source && source.deleted))
        chunks.push({ n: logNumber(s.key), key: s.key, hash: source.hash });
    }
    return this.#logMatches(meta.value, chunks);
  }

  #deferred(list: readonly KeyState[]): false {
    this.#defer(list);
    return false;
  }

  /** The remote side's pulled records are replaced by this device's: push what differs, delete what is gone here. */
  #localOverRemote(list: readonly KeyState[], pushes: PushItem[]): void {
    for (const s of list) {
      if (s.local) {
        if (s.localChanged || s.remote) this.#pushOf(s, pushes);
      } else if (s.remote ? !s.remote.deleted : s.entry !== undefined && !s.entry.deleted) {
        // Gone here (a truncated log, a removed game): a tombstone for what the server still holds.
        pushes.push({ key: s.key, recordKey: s.recordKey, baseVersion: this.#base(s), record: undefined });
      }
    }
  }

  /** This device's game becomes the remote one, whole: every remote record written, local extras removed. */
  #remoteOverLocal(list: readonly KeyState[], full: ReadonlyMap<string, Pulled>, into: Apply): void {
    for (const [key, p] of full) {
      if (p.deleted) continue;
      into.writes.push({ key, value: p.value });
      into.entries.push({
        key,
        recordKey: p.recordKey,
        version: p.version,
        hash: p.hash,
        stamp: p.stamp,
        deleted: false,
      });
    }
    for (const s of list) {
      if (full.has(s.key) && !full.get(s.key)!.deleted) continue;
      if (!s.local) continue;
      into.deletes.push(s.key);
      into.entries.push({
        key: s.key,
        recordKey: s.recordKey,
        version: s.remote?.version ?? s.entry?.version ?? 0,
        hash: "",
        stamp: 0,
        deleted: true,
      });
    }
  }

  /**
   * Which side's log is ahead, judged chunk by chunk: a chunk only one side changed is that side's; one both changed
   * must have one as a prefix of the other (the longer is ahead); two sides each ahead somewhere, or neither a prefix
   * of the other, have diverged. With no log difference at all, the later meta stamp decides.
   */
  #analyse(list: readonly KeyState[]): "local" | "remote" | "diverged" {
    const ahead = new Set<"local" | "remote">();
    for (const s of list) {
      if (partOf(s.key) === "baseline") {
        // A baseline both sides changed has diverged; changed on one side it counts as that side being ahead, so
        // the other side's log moving at the same time is a divergence too.
        if (s.localChanged && s.remote) return "diverged";
        if (s.localChanged) ahead.add("local");
        else if (s.remote) ahead.add("remote");
        continue;
      }
      if (partOf(s.key) !== "log") continue;
      const remoteChanged = s.remote !== undefined;
      if (!s.localChanged && !remoteChanged) continue;
      if (s.localChanged && !remoteChanged) ahead.add("local");
      else if (!s.localChanged) ahead.add("remote");
      else {
        const mine = s.local ? commandsOf(s.local.value) : [];
        const theirs = s.remote!.deleted ? [] : commandsOf(s.remote!.value);
        if (isPrefix(mine, theirs)) {
          if (theirs.length > mine.length) ahead.add("remote");
        } else if (isPrefix(theirs, mine)) ahead.add("local");
        else return "diverged";
      }
    }
    if (ahead.size === 2) return "diverged";
    if (ahead.size === 1) return [...ahead][0]!;
    const meta = list.find((s) => partOf(s.key) === "meta");
    const remoteStamp = meta?.remote && !meta.remote.deleted ? meta.remote.stamp : -1;
    return remoteStamp > (meta?.local?.stamp ?? -1) ? "remote" : "local";
  }

  /** A game on both sides that this device never synced before: different logs always go to the player. */
  #firstContactDiffers(list: readonly KeyState[]): boolean {
    const meta = list.find((s) => partOf(s.key) === "meta");
    if (!meta || meta.entry || !meta.local || !meta.remote || meta.remote.deleted) return false;
    const log = (v: unknown) => (v as { logHash?: unknown } | null)?.logHash;
    return log(meta.local.value) !== log(meta.remote.value);
  }

  /** The server's current records for a game, read in full (a conflict needs both sides whole). */
  async #fullGame(gameId: string, list: readonly KeyState[]): Promise<Map<string, Pulled> | null> {
    const cached = this.#fullGames.get(gameId);
    if (cached) return cached;
    if (!this.#fullState) {
      const all = new Map<string, { version: number; deleted: boolean; data?: string | undefined }>();
      let since = 0;
      for (;;) {
        const got = await this.#api.changes(this.#creds, since);
        if (!got.ok) throw new Error(`could not read the cloud copy of a game (${got.failure.kind})`);
        for (const r of got.changes.records) {
          this.#counts.pulled++;
          all.set(r.key, { version: r.version, deleted: r.deleted, data: r.data });
        }
        if (!got.changes.more || got.changes.cursor <= since) break;
        since = got.changes.cursor;
      }
      this.#fullState = all;
    }
    const full = new Map<string, Pulled>();
    for (const s of list) {
      const rec = s.remote ?? undefined;
      const stored = this.#fullState.get(s.recordKey);
      if (rec && !rec.deleted) {
        full.set(s.key, rec);
      } else if (stored && !stored.deleted && stored.data !== undefined) {
        let opened: { key: string; stamp: number; value: unknown };
        try {
          opened = await openRecord(this.#creds, s.recordKey, stored.data);
        } catch {
          await this.#park(s.recordKey, stored.version);
          this.#counts.skipped++;
          return null;
        }
        full.set(s.key, {
          recordKey: s.recordKey,
          version: stored.version,
          deleted: false,
          key: opened.key,
          stamp: opened.stamp,
          value: opened.value,
          hash: await hashValue(opened.value),
        });
      } else if (stored?.deleted || rec?.deleted) {
        full.set(s.key, {
          recordKey: s.recordKey,
          version: stored?.version ?? rec!.version,
          deleted: true,
          key: s.key,
          stamp: 0,
          value: null,
          hash: "",
        });
      }
    }
    this.#fullGames.set(gameId, full);
    return full;
  }

  // ---- push ------------------------------------------------------------------------------------------------------

  async #push(items: readonly PushItem[]): Promise<{ conflicts: number } | { failure: SyncRunFailure }> {
    const partRank = { log: 0, baseline: 1, meta: 2 } as const;
    // Within a game: log chunks, then the baseline, then the meta, so a device that sees the meta finds the rest.
    const ordered = [...items].sort((a, b) => {
      const ga = gameIdOf(a.key) ?? "";
      const gb = gameIdOf(b.key) ?? "";
      if (ga !== gb) return ga < gb ? -1 : 1;
      const pa = partOf(a.key);
      const pb = partOf(b.key);
      if (pa && pb && pa !== pb) return partRank[pa] - partRank[pb];
      if (pa === "log" && pb === "log") return logNumber(a.key) - logNumber(b.key);
      return a.key < b.key ? -1 : a.key > b.key ? 1 : 0;
    });

    const sealed: { item: PushItem; op: SyncOp; bytes: number }[] = [];
    for (const item of ordered) {
      if (!item.record) {
        sealed.push({ item, op: { key: item.recordKey, baseVersion: item.baseVersion, deleted: true }, bytes: 0 });
        continue;
      }
      const { recordKey, data } = await sealRecord(this.#creds, item.key, item.record.value, item.record.stamp);
      const bytes = Math.floor((data.length * 3) / 4);
      if (bytes > MAX_RECORD_BYTES) {
        this.#counts.skipped++;
        continue;
      }
      sealed.push({ item, op: { key: recordKey, baseVersion: item.baseVersion, data }, bytes });
    }

    let conflicts = 0;
    let at = 0;
    while (at < sealed.length) {
      const group: typeof sealed = [];
      let bytes = 0;
      while (at < sealed.length && group.length < MAX_BATCH_OPS) {
        const next = sealed[at]!;
        if (group.length > 0 && bytes + next.bytes > MAX_BATCH_BYTES) break;
        group.push(next);
        bytes += next.bytes;
        at++;
      }
      const sent = await this.#api.batch(
        this.#creds,
        group.map((g) => g.op),
      );
      if (!sent.ok) return { failure: sent.failure };
      const done: SyncedEntry[] = [];
      let accepted = 0;
      sent.result.results.forEach((result, i) => {
        const { item } = group[i]!;
        if (!result.ok) {
          conflicts++;
          return;
        }
        accepted++;
        done.push({
          key: item.key,
          recordKey: item.recordKey,
          version: result.version,
          hash: item.record?.hash ?? "",
          stamp: item.record?.stamp ?? 0,
          deleted: item.record === undefined,
        });
      });
      this.#counts.pushed += accepted;
      await this.#commit(done);
      // Versions are one counter per space: when ours are the only writes since the pull, the cursor can follow.
      if (accepted === group.length && sent.result.cursor === this.#cursor + accepted)
        this.#cursor = sent.result.cursor;
    }
    return { conflicts };
  }
}

function knowsSavedStore(database: string, store: string): boolean {
  return SAVED_DATABASES.some((db) => db.name === database && db.stores.some((s) => s.name === store));
}
