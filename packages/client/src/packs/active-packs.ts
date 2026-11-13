/**
 * Loading the installed custom packs into the running app (docs/custom-content-packs.md §7.4): every pack in the
 * `PackStore` is read, validated (in a worker) and, if it passes, added to the loaded set that `content/pool.ts`'s
 * `currentPool()` and a new game's `SessionConfig.packs` read. A pack that is damaged, fails validation, needs a newer
 * app or needs a pack that is not loaded is skipped with a reason the Mod Store can show; it never blocks the others or
 * the app. A withdrawn pack stays loaded: withdrawal only hides it from the store, it stays playable (§11.4).
 *
 * Call `refreshActivePacks()` at boot (not awaited) and after an install, update or remove.
 */
import type { PackManifest } from "@mc/content";
import { IdbPackStore, type InstalledPack, type PackStorage } from "./pack-store.js";
import { LOAD_IDLE_MS, loadInWorker, spawnLoadWorker } from "./load-client.js";
import type { PackLoadResult, RequiredPackContent } from "./pack-load.js";
import { setLoadedPacks } from "./pack-registry.js";
import type { PackRuntime } from "./pack-runtime.js";
import { POOL_STARTER_DECKS } from "../content/pool.js";
import { setPackArt } from "../art/pack-art.js";

export interface ActivePackStatus {
  readonly id: string;
  readonly version: string;
  readonly name: string;
  readonly loaded: boolean;
  /** Why a pack was skipped; undefined when it loaded. */
  readonly reason?: string;
  /** Things worth telling the player about a pack that did load (a precon dropped because its id is a base game deck's). */
  readonly notes?: readonly string[];
}

/** Loads one pack's files; replaceable so a test can fail it or run it in-thread. */
export type PackLoader = (
  manifest: PackManifest,
  files: ReadonlyMap<string, Uint8Array>,
  required: RequiredPackContent,
  /** Reads the pack's files again, for a loader that handed the first set away and then needs them back. */
  reread?: () => Promise<ReadonlyMap<string, Uint8Array> | string>,
) => Promise<PackLoadResult>;

const defaultLoader: PackLoader = (manifest, files, required, reread) =>
  loadInWorker(manifest, files, required, spawnLoadWorker, LOAD_IDLE_MS, reread);

let statuses: readonly ActivePackStatus[] = [];
const listeners = new Set<(statuses: readonly ActivePackStatus[]) => void>();
let generation = 0;
let sharedStore: PackStorage | undefined;

/** The app's one pack store: the Mod Store installs and removes through it, so its cached blob URLs are revoked on the same instance the art reads from. */
export function sharedPackStore(): PackStorage {
  sharedStore ??= new IdbPackStore();
  return sharedStore;
}

/** The outcome of the last load, one entry per installed pack. */
export function activePackStatuses(): readonly ActivePackStatus[] {
  return statuses;
}

/** Calls `listener` after each load finishes; returns the unsubscribe. */
export function onActivePackStatuses(listener: (statuses: readonly ActivePackStatus[]) => void): () => void {
  listeners.add(listener);
  return () => void listeners.delete(listener);
}

async function readFiles(store: PackStorage, pack: InstalledPack): Promise<ReadonlyMap<string, Uint8Array> | string> {
  const files = new Map<string, Uint8Array>();
  for (const entry of pack.manifest.files) {
    try {
      const blob = await store.fileBlob(pack.id, entry.path);
      if (!blob) return `${entry.path} is missing from the store`;
      files.set(entry.path, new Uint8Array(await blob.arrayBuffer()));
    } catch (error) {
      // One pack's unreadable file skips that pack only; the others still load.
      return `${entry.path} could not be read (${error instanceof Error ? error.message : String(error)})`;
    }
  }
  return files;
}

/**
 * Loads every installed pack from `store` and replaces the app's loaded set with the ones that pass. Packs are tried in
 * install order, and a pack that lists `requires.packs` is retried after the others, so it loads after what it needs.
 * Resolves to the status of each pack. A newer call supersedes an older one still running: only the newest call's
 * result is applied.
 */
export async function loadActivePacks(
  store: PackStorage,
  load: PackLoader = defaultLoader,
): Promise<readonly ActivePackStatus[]> {
  const mine = ++generation;
  let installed: InstalledPack[];
  try {
    installed = (await store.list()).sort((a, b) => a.installedAt.localeCompare(b.installedAt));
  } catch {
    installed = [];
  }
  const loaded = new Map<string, PackRuntime>();
  const skipped = new Map<string, string>();
  const notes = new Map<string, string[]>();
  const baseDeckIds = new Set(POOL_STARTER_DECKS.map((deck) => deck.id as string));
  const deckOwner = new Map<string, string>();
  // Scenario and encounter set ids are global too: the first pack loaded (install order, a dependent after what it
  // needs) owns an id and a later pack that reuses it is skipped, so the outcome follows the install order, not luck.
  const scenarioOwner = new Map<string, string>();
  const setOwner = new Map<string, string>();
  let pending = installed;
  for (let progress = true; progress && pending.length > 0;) {
    progress = false;
    const waiting: InstalledPack[] = [];
    for (const pack of pending) {
      const needs = pack.manifest.requires?.packs ?? [];
      const absent = needs.filter((id) => !loaded.has(id));
      if (absent.length > 0) {
        skipped.set(pack.id, `Needs ${absent.join(", ")} to be installed and working`);
        waiting.push(pack);
        continue;
      }
      const files = await readFiles(store, pack);
      const result: PackLoadResult =
        typeof files === "string"
          ? { ok: false, reason: `Damaged: ${files}` }
          : await load(
              pack.manifest,
              files,
              {
                cards: needs.flatMap((id) => loaded.get(id)!.cards),
                encounterSets: needs.flatMap((id) => loaded.get(id)!.encounterSets ?? []),
                scenarios: needs.flatMap((id) => loaded.get(id)!.scenarios ?? []),
              },
              () => readFiles(store, pack),
            );
      const clash = result.ok ? result.runtime.decks.find((deck) => deckOwner.has(deck.id as string)) : undefined;
      const scenarioClash = result.ok
        ? result.runtime.scenarios?.find((scenario) => scenarioOwner.has(scenario.id as string))
        : undefined;
      const setClash = result.ok
        ? result.runtime.encounterSets?.find((set) => setOwner.has(set.id as string))
        : undefined;
      if (result.ok && clash) {
        skipped.set(pack.id, `Deck ${clash.id as string} is already used by ${deckOwner.get(clash.id as string)}`);
      } else if (scenarioClash) {
        skipped.set(
          pack.id,
          `Scenario ${scenarioClash.id as string} is already used by ${scenarioOwner.get(scenarioClash.id as string)}`,
        );
      } else if (setClash) {
        skipped.set(
          pack.id,
          `Encounter set ${setClash.id as string} is already used by ${setOwner.get(setClash.id as string)}`,
        );
      } else if (result.ok) {
        // A base game precon id is never taken from a pack (base wins): the pack's deck of that id is dropped.
        const shadowing = result.runtime.decks.filter((deck) => baseDeckIds.has(deck.id as string));
        const runtime =
          shadowing.length === 0
            ? result.runtime
            : { ...result.runtime, decks: result.runtime.decks.filter((deck) => !baseDeckIds.has(deck.id as string)) };
        if (shadowing.length > 0)
          notes.set(
            pack.id,
            shadowing.map((deck) => `Deck ${deck.id as string} ignored: that id belongs to a base game deck`),
          );
        for (const deck of runtime.decks) deckOwner.set(deck.id as string, pack.id);
        for (const scenario of runtime.scenarios ?? []) scenarioOwner.set(scenario.id as string, pack.id);
        for (const set of runtime.encounterSets ?? []) setOwner.set(set.id as string, pack.id);
        loaded.set(pack.id, runtime);
        skipped.delete(pack.id);
        progress = true;
      } else {
        skipped.set(pack.id, result.reason);
      }
    }
    // Only a pack that was waiting on another is worth another pass; one that failed fails the same way again.
    pending = waiting;
  }
  const result: ActivePackStatus[] = installed.map((pack) => {
    const base = { id: pack.id, version: pack.version, name: pack.manifest.name };
    return loaded.has(pack.id)
      ? { ...base, loaded: true, ...(notes.has(pack.id) ? { notes: notes.get(pack.id)! } : {}) }
      : { ...base, loaded: false, reason: skipped.get(pack.id) ?? "Not loaded" };
  });
  if (mine !== generation) return result;
  statuses = result;
  setLoadedPacks(installed.flatMap((pack) => loaded.get(pack.id) ?? []));
  // The loaded packs' card pictures (`art/pack-art.ts`), read from the same store.
  setPackArt(
    installed.filter((pack) => loaded.has(pack.id)).map((pack) => pack.manifest),
    store,
  );
  for (const listener of [...listeners]) listener(result);
  return result;
}

/**
 * Loads from the app's own IndexedDB store. Safe to call without awaiting (boot) and never rejects: a store that cannot
 * open leaves the base game as it was.
 */
export async function refreshActivePacks(store?: PackStorage): Promise<readonly ActivePackStatus[]> {
  try {
    if (store) return await loadActivePacks(store);
    return await loadActivePacks(sharedPackStore());
  } catch {
    return statuses;
  }
}
