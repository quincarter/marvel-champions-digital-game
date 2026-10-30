/**
 * Sends finished games to the global win rates (`POST /global/result`), only while sharing is on
 * (`global-consent.ts`). Quiet by design: it never throws, never blocks play and never shows anything.
 *
 * A run lists the saves, takes the finished games this device has not sent (and that were last written after sharing
 * was turned on), and posts at most `MAX_PER_RUN` of them one at a time. 200 and 400 mark a game sent (the Worker has it,
 * or never will); 429, 503, a network error or anything else stops the run and the game is tried again on the next one.
 *
 * Runs once per launch after the stats backfill and again, debounced, after the engine worker reports a save
 * (`startGlobalUploads`): the worker's `saved` message reaches the main thread as `notifySaveDataChanged`, and a game's
 * ending is one of those writes. A run with sharing off reads one localStorage key and stops.
 */
import type { SaveMeta } from "../engine/game-storage.js";
import { onSaveDataChanged } from "../sync/save-data-changed.js";
import { syncServiceUrl } from "../save-data/transfer-config.js";
import { POOL_STATS_NAMES } from "../view/player-stats-names.js";
import type { StatsNames } from "../view/player-stats-model.js";
import {
  browserStorage,
  consentSince,
  highWater,
  markSent,
  readConsent,
  readSent,
  type ConsentStorage,
} from "./global-consent.js";
import { globalIdOf, globalResultOf } from "./global-result.js";

export const MAX_PER_RUN = 5;
export const UPLOAD_TIMEOUT_MS = 10_000;
/**
 * The Worker checks an id against this calendar month and the last, so the soonest a sent id can be forgotten is 29 days
 * later (January 31 to March 1). A game is never sent past this age, so a late device cannot count it twice.
 */
export const MAX_AGE_MS = 28 * 24 * 60 * 60 * 1000;
/** After a save signal, how long play must be quiet before a run starts. */
export const RUN_DEBOUNCE_MS = 10_000;

export interface UploadStore {
  listSaves(): Promise<readonly SaveMeta[]>;
  /** The session store's state, when the caller has one: a game still being played holds the listener back. */
  readonly state?: { readonly game: { readonly outcome?: unknown } | null };
}

/** The longest a `Retry-After` is honoured (seconds). */
const MAX_RETRY_AFTER_S = 3600;

export interface UploadDeps {
  readonly baseUrl: string | null;
  readonly fetch: typeof fetch;
  readonly storage: ConsentStorage | null;
  readonly names: StatsNames;
  readonly maxPerRun: number;
  readonly timeoutMs: number;
  readonly now: () => number;
}

const defaultDeps = (): UploadDeps => ({
  baseUrl: syncServiceUrl(),
  fetch: (...args) => globalThis.fetch(...args),
  storage: browserStorage(),
  names: POOL_STATS_NAMES,
  maxPerRun: MAX_PER_RUN,
  timeoutMs: UPLOAD_TIMEOUT_MS,
  now: () => Date.now(),
});

let running = false;
/** Nothing is sent before this time (ms), set by a 429's `Retry-After`; this page load only. */
let nextTryAt = 0;
export const resetGlobalUploadBackoff = (): void => {
  nextTryAt = 0;
};

/** Sends what is due; resolves to how many games were accepted or refused for good. Never throws. */
export async function runGlobalUpload(store: UploadStore, overrides: Partial<UploadDeps> = {}): Promise<number> {
  const deps = { ...defaultDeps(), ...overrides };
  if (running || !deps.baseUrl || readConsent(deps.storage) !== "on" || deps.now() < nextTryAt) return 0;
  running = true;
  try {
    const since = Math.max(consentSince(deps.storage) ?? Number.POSITIVE_INFINITY, highWater(deps.storage) + 1);
    const sent = readSent(deps.storage);
    const due = (await store.listSaves())
      .filter(
        (meta) =>
          !meta.guided &&
          (meta.status === "won" || meta.status === "lost") &&
          !sent.has(meta.id) &&
          meta.updatedAt >= since &&
          meta.updatedAt >= deps.now() - MAX_AGE_MS,
      )
      .sort((a, b) => a.updatedAt - b.updatedAt);
    let done = 0;
    for (const meta of due) {
      if (done >= deps.maxPerRun) break;
      // Sharing may have been turned off while the run was going.
      if (readConsent(deps.storage) !== "on") break;
      const result = globalResultOf(meta, deps.names, await globalIdOf(meta.id));
      if (!result) continue;
      let status: number;
      let retryAfter = 0;
      try {
        const response = await deps.fetch(`${deps.baseUrl}/global/result`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(result),
          signal: AbortSignal.timeout(deps.timeoutMs),
        });
        status = response.status;
        retryAfter = Number(response.headers.get("Retry-After"));
      } catch {
        break;
      }
      if (status === 429) {
        if (Number.isFinite(retryAfter) && retryAfter > 0)
          nextTryAt = deps.now() + Math.min(retryAfter, MAX_RETRY_AFTER_S) * 1000;
        break;
      }
      // 507: the Worker is full for this game and would be again on every run, so it is let go and the run ends.
      if (status !== 200 && status !== 400 && status !== 507) break;
      markSent([meta.id], deps.storage, meta.updatedAt);
      done++;
      if (status === 507) break;
    }
    return done;
  } catch {
    return 0;
  } finally {
    running = false;
  }
}

/**
 * Runs once now and again after each quiet spell following a save signal. Returns the stop function. Safe to call with
 * sharing off: every run checks the consent first.
 */
export function startGlobalUploads(
  store: UploadStore,
  overrides: Partial<UploadDeps> = {},
  debounceMs: number = RUN_DEBOUNCE_MS,
): () => void {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const run = (): void => void runGlobalUpload(store, overrides).catch(() => undefined);
  const off = onSaveDataChanged((reason) => {
    if (reason !== "game" && reason !== "turn") return;
    // Sharing off: no timer, no listing.
    if (readConsent(overrides.storage ?? browserStorage()) !== "on") return;
    // A game still being played has not finished; the listing waits for its end (outcome) or for no game on the table.
    const game = store.state?.game;
    if (game && !game.outcome) return;
    if (timer !== undefined) clearTimeout(timer);
    timer = setTimeout(run, debounceMs);
  });
  run();
  return () => {
    off();
    if (timer !== undefined) clearTimeout(timer);
  };
}
