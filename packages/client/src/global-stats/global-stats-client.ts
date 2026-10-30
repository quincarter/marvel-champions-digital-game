/**
 * Reads the global win rates (`GET /global/stats`, `GET /global/cards?villain=`). Nothing is requested until a screen
 * asks; never at launch. An answer is cached in memory and in `localStorage` (non-`mc-` keys, so device sync leaves them)
 * for 6 hours, and the stale copy is answered when the Worker is down. Never throws: no Worker, a network error, a
 * timeout or a body of the wrong shape is `{ kind: "unavailable" }`, and the game plays on without it.
 */
import type { GlobalRow, GlobalStats, GlobalVillainCards } from "@mc/sync-worker/global-protocol";
import { syncServiceUrl } from "../save-data/transfer-config.js";
import { browserStorage, type ConsentStorage } from "./global-consent.js";

export const GLOBAL_STATS_TTL_MS = 6 * 60 * 60 * 1000;
export const GLOBAL_FETCH_TIMEOUT_MS = 10_000;
export const GLOBAL_STATS_CACHE_KEY = "global-stats-cache";
export const GLOBAL_CARDS_CACHE_KEY = "global-cards-cache";
/** How many villains' card lists are kept on this device. */
const CARDS_CACHE_CAP = 24;

export type GlobalLoad<T> =
  /** `stale`: the Worker could not be reached and this is the last copy. */
  | { readonly kind: "ready"; readonly data: T; readonly stale: boolean }
  /** The Worker has nothing to show for this yet (too few games). */
  | { readonly kind: "none" }
  | { readonly kind: "unavailable" };

export interface GlobalClientDeps {
  readonly baseUrl: string | null;
  readonly fetch: typeof fetch;
  readonly storage: ConsentStorage | null;
  readonly now: () => number;
  readonly timeoutMs: number;
}

const defaultDeps = (): GlobalClientDeps => ({
  baseUrl: syncServiceUrl(),
  fetch: (...args) => globalThis.fetch(...args),
  storage: browserStorage(),
  now: () => Date.now(),
  timeoutMs: GLOBAL_FETCH_TIMEOUT_MS,
});

interface Cached<T> {
  readonly at: number;
  readonly data: T;
}

/** Page-load memory, by cache key. Tests clear it. */
const memory = new Map<string, Cached<unknown>>();
export const clearGlobalMemory = (): void => memory.clear();

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null;
const isCount = (v: unknown): v is number => typeof v === "number" && Number.isSafeInteger(v) && v >= 0;
const isCounts = (v: unknown): v is Record<string, number> => isObject(v) && Object.values(v).every(isCount);

function isRow(v: unknown): v is GlobalRow {
  return isObject(v) && typeof v.key === "string" && isCount(v.games) && isCount(v.wins) && isCounts(v.causes);
}
const isRows = (v: unknown): v is GlobalRow[] => Array.isArray(v) && v.every(isRow);

export function isGlobalStats(v: unknown): v is GlobalStats {
  return (
    isObject(v) &&
    isCount(v.updatedAt) &&
    isCount(v.games) &&
    isRows(v.villains) &&
    isRows(v.modulars) &&
    isRows(v.heroes)
  );
}

export function isGlobalVillainCards(v: unknown): v is GlobalVillainCards {
  return (
    isObject(v) &&
    typeof v.villain === "string" &&
    isCount(v.wins) &&
    isCount(v.losses) &&
    isCounts(v.inWins) &&
    isCounts(v.inLosses)
  );
}

function readJson(storage: ConsentStorage | null, key: string): unknown {
  try {
    const raw = storage?.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function writeJson(storage: ConsentStorage | null, key: string, value: unknown): void {
  try {
    storage?.setItem(key, JSON.stringify(value));
  } catch {
    // A full quota: the memory copy still serves this page load.
  }
}

/** One GET with the cache around it; `slot` is the cache entry, `read`/`write` reach its stored copy. */
async function load<T>(
  deps: GlobalClientDeps,
  path: string,
  slot: string,
  check: (body: unknown) => body is T,
  stored: { read: () => Cached<T> | null; write: (entry: Cached<T>) => void },
): Promise<GlobalLoad<T>> {
  const now = deps.now();
  const known = (memory.get(slot) as Cached<T> | undefined) ?? stored.read();
  if (known) memory.set(slot, known);
  if (known && now - known.at >= 0 && now - known.at < GLOBAL_STATS_TTL_MS)
    return { kind: "ready", data: known.data, stale: false };
  const stale = (): GlobalLoad<T> =>
    known ? { kind: "ready", data: known.data, stale: true } : { kind: "unavailable" };
  if (!deps.baseUrl) return stale();
  try {
    const response = await deps.fetch(`${deps.baseUrl}${path}`, { signal: AbortSignal.timeout(deps.timeoutMs) });
    if (response.status === 404) {
      const body: unknown = await response.json().catch(() => null);
      // The Worker's own "nothing for this villain" is an answer; a 404 without it is a Worker without these routes.
      if (isObject(body) && body.reason === "not-found") return { kind: "none" };
      return stale();
    }
    if (response.status !== 200) return stale();
    const body: unknown = await response.json();
    if (!check(body)) return stale();
    const entry = { at: now, data: body };
    memory.set(slot, entry);
    stored.write(entry);
    return { kind: "ready", data: body, stale: false };
  } catch {
    return stale();
  }
}

export function loadGlobalStats(overrides: Partial<GlobalClientDeps> = {}): Promise<GlobalLoad<GlobalStats>> {
  const deps = { ...defaultDeps(), ...overrides };
  return load(deps, "/global/stats", GLOBAL_STATS_CACHE_KEY, isGlobalStats, {
    read: () => {
      const v = readJson(deps.storage, GLOBAL_STATS_CACHE_KEY);
      return isObject(v) && isCount(v.at) && isGlobalStats(v.data) ? { at: v.at, data: v.data } : null;
    },
    write: (entry) => writeJson(deps.storage, GLOBAL_STATS_CACHE_KEY, entry),
  }).catch((): GlobalLoad<never> => ({ kind: "unavailable" }));
}

export function loadGlobalVillainCards(
  villain: string,
  overrides: Partial<GlobalClientDeps> = {},
): Promise<GlobalLoad<GlobalVillainCards>> {
  const deps = { ...defaultDeps(), ...overrides };
  const readAll = (): Record<string, Cached<GlobalVillainCards>> => {
    const v = readJson(deps.storage, GLOBAL_CARDS_CACHE_KEY);
    return isObject(v) ? (v as Record<string, Cached<GlobalVillainCards>>) : {};
  };
  return load(
    deps,
    `/global/cards?villain=${encodeURIComponent(villain)}`,
    `${GLOBAL_CARDS_CACHE_KEY}:${villain}`,
    isGlobalVillainCards,
    {
      read: () => {
        const v = readAll()[villain];
        return isObject(v) && isCount(v.at) && isGlobalVillainCards(v.data) ? { at: v.at, data: v.data } : null;
      },
      write: (entry) => {
        const all = { ...readAll(), [villain]: entry };
        const newest = Object.entries(all)
          .sort(([, a], [, b]) => b.at - a.at)
          .slice(0, CARDS_CACHE_CAP);
        writeJson(deps.storage, GLOBAL_CARDS_CACHE_KEY, Object.fromEntries(newest));
      },
    },
  ).catch((): GlobalLoad<never> => ({ kind: "unavailable" }));
}
