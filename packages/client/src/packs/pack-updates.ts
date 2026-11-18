/**
 * How many installed mod packs the store has a newer version of, for the count badge on the Title's Mod Store button
 * and its storefront icon. A pack counts when the store screen would offer it an Update button
 * (`packStateOf(...).state === "update"`): a newer version this game can install. One this game is too old for, a
 * withdrawn one and one the catalog no longer lists do not count, since the player can do nothing about them in the
 * store.
 *
 * `checkPackUpdates()` reads the catalog (at most once per `CHECK_INTERVAL_MS`, else the copy it read last) and the
 * installed packs, and tells the listeners when the count changes. The Mod Store hands over what it loaded itself
 * (`notePackUpdates`), so an update made there clears the badge without a second fetch.
 */
import type { PackIndex } from "@mc/content";
import { packStateOf } from "./pack-state.js";
import type { InstalledPack, PackStorage } from "./pack-store.js";
import { cachedCatalog, isNewerCatalog, loadCatalog, saveCatalog, type CatalogDeps } from "./catalog.js";
import { sharedPackStore } from "./active-packs.js";
import { SUPPORTED_DSL_FEATURES } from "./supported-features.js";
import { CLIENT_VERSION } from "../version.js";

/** How long a fetched catalog answers the Title before it is fetched again. */
export const CHECK_INTERVAL_MS = 15 * 60 * 1000;

/** How long the Title waits on the catalog before it gives up and counts from the saved copy. */
export const FETCH_TIMEOUT_MS = 20 * 1000;

export interface PackUpdateContext {
  readonly appVersion: string;
  readonly supportedDslFeatures: readonly string[];
}

const APP_CONTEXT: PackUpdateContext = { appVersion: CLIENT_VERSION, supportedDslFeatures: SUPPORTED_DSL_FEATURES };

/** The installed packs `index` offers an installable update for. Pure. */
export function packUpdateCountOf(
  index: PackIndex,
  installed: readonly Pick<InstalledPack, "id" | "version" | "withdrawn">[],
  context: PackUpdateContext = APP_CONTEXT,
): number {
  const byId = new Map(installed.map((pack) => [pack.id, pack]));
  let count = 0;
  for (const entry of index.packs) {
    const pack = byId.get(entry.id);
    if (!pack) continue;
    if (packStateOf({ entry, installed: pack, ...context }).state === "update") count += 1;
  }
  return count;
}

/** The badge's words: the count, capped at "9+" so it stays one small disc. */
export function badgeTextOf(count: number): string {
  return count > 9 ? "9+" : String(count);
}

let count = 0;
let lastIndex: PackIndex | undefined;
let lastFetched = Number.NEGATIVE_INFINITY;
let inFlight: Promise<number> | undefined;
/** Bumped by each `notePackUpdates`: a check that started before it read an older installed list, and reads it again. */
let noted = 0;
const listeners = new Set<(count: number) => void>();

/** The last count worked out; 0 until a check has run. */
export function packUpdateCount(): number {
  return count;
}

/** Calls `listener` whenever the count changes; returns the unsubscribe. */
export function onPackUpdateCount(listener: (count: number) => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function setCount(next: number): void {
  if (next === count) return;
  count = next;
  for (const listener of [...listeners]) listener(count);
}

/**
 * The Mod Store's own catalog and installed list, after it loads or changes a pack. `offline` (the store showed its
 * saved copy) keeps the next Title check reaching for the network.
 */
export function notePackUpdates(
  index: PackIndex | undefined,
  installed: readonly InstalledPack[],
  offline = false,
): void {
  noted += 1;
  // A store answer older than the catalog already remembered (requests that crossed) leaves that one in place.
  if (index && !(lastIndex && isNewerCatalog(lastIndex, index))) {
    lastIndex = index;
    // An offline copy is never fresh: the next Title check reaches for the network again.
    lastFetched = offline ? Number.NEGATIVE_INFINITY : Date.now();
  }
  const known = lastIndex ?? index;
  if (known) setCount(packUpdateCountOf(known, installed));
}

export interface CheckDeps extends CatalogDeps {
  readonly store?: Pick<PackStorage, "list">;
  readonly now?: () => number;
  /** Fetch even when the last catalog is fresh. */
  readonly force?: boolean;
  /** How long to wait on the catalog (`FETCH_TIMEOUT_MS`). */
  readonly timeoutMs?: number;
}

/**
 * Works the count out again and returns it. Never throws: with no network it uses the saved catalog, and with no
 * catalog at all (or nothing installed) the count is 0. Concurrent calls share one check.
 */
export function checkPackUpdates(deps: CheckDeps = {}): Promise<number> {
  inFlight ??= runCheck(deps).finally(() => {
    inFlight = undefined;
  });
  return inFlight;
}

async function runCheck(deps: CheckDeps): Promise<number> {
  const now = deps.now ?? Date.now;
  const started = noted;
  let installed: readonly InstalledPack[];
  try {
    installed = await (deps.store ?? sharedPackStore()).list();
  } catch {
    return count;
  }
  // Nothing installed: nothing to update, and no reason to reach the network.
  if (installed.length === 0) {
    // Unless the store noted a change while the list was read: its count is the newer one.
    if (noted === started) setCount(0);
    return count;
  }
  let index = lastIndex;
  if (deps.force || !index || now() - lastFetched >= CHECK_INTERVAL_MS) {
    // The saved copy is read and written here rather than by `loadCatalog`, so a response that lands after the store
    // noted a newer catalog never replaces the store's saved copy either.
    let fresh: PackIndex | undefined;
    try {
      // Bounded, so a request that hangs never holds the shared check (and every later one) open.
      let timer: ReturnType<typeof setTimeout> | undefined;
      const timeout = new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error("The catalog took too long")), deps.timeoutMs ?? FETCH_TIMEOUT_MS);
      });
      try {
        fresh = (await Promise.race([loadCatalog({ ...deps, storage: null }), timeout])).index;
      } finally {
        clearTimeout(timer);
      }
    } catch {
      // Offline: the saved copy is counted from, but not fresh, so the next check tries the network again.
      // Another tab or a store load may have saved a newer copy since this one was remembered.
      const saved = cachedCatalog(deps.storage);
      if (saved && (!index || isNewerCatalog(saved, index))) index = saved;
    }
    if (fresh) {
      // Whatever else landed while this fetch waited (the store noting its catalog, another tab saving one, a stale CDN
      // answer here), the newest copy (`isNewerCatalog`) among the fetched, saved and remembered ones is counted from
      // and kept. The one in memory counts too: with no storage (or a failed write) it may be the only newer copy.
      let newest = fresh;
      for (const other of [cachedCatalog(deps.storage), lastIndex]) {
        if (other && isNewerCatalog(other, newest)) newest = other;
      }
      index = newest;
      lastIndex = newest;
      lastFetched = now();
      saveCatalog(newest, deps.storage);
    }
  }
  // The Mod Store installed, updated or removed a pack while this check waited: count against today's list, and from
  // the newest catalog either of us holds.
  // Read again until a read finishes with no store change behind it; after a few tries the store's own count stands.
  let seen = started;
  for (let tries = 0; noted !== seen; tries += 1) {
    if (tries === 3) return count;
    seen = noted;
    try {
      installed = await (deps.store ?? sharedPackStore()).list();
    } catch {
      return count;
    }
    if (lastIndex && (!index || isNewerCatalog(lastIndex, index))) index = lastIndex;
  }
  if (index) setCount(packUpdateCountOf(index, installed));
  return count;
}

/** Test hook: forget the count, the catalog and the listeners. */
export function resetPackUpdatesForTest(): void {
  count = 0;
  lastIndex = undefined;
  lastFetched = Number.NEGATIVE_INFINITY;
  inFlight = undefined;
  noted = 0;
  listeners.clear();
}
