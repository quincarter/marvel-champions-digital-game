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
  markSent,
  readConsent,
  readSent,
  type ConsentStorage,
} from "./global-consent.js";
import { globalIdOf, globalResultOf } from "./global-result.js";

export const MAX_PER_RUN = 5;
export const UPLOAD_TIMEOUT_MS = 10_000;
/** After a save signal, how long play must be quiet before a run starts. */
export const RUN_DEBOUNCE_MS = 10_000;

export interface UploadStore {
  listSaves(): Promise<readonly SaveMeta[]>;
}

export interface UploadDeps {
  readonly baseUrl: string | null;
  readonly fetch: typeof fetch;
  readonly storage: ConsentStorage | null;
  readonly names: StatsNames;
  readonly maxPerRun: number;
  readonly timeoutMs: number;
}

const defaultDeps = (): UploadDeps => ({
  baseUrl: syncServiceUrl(),
  fetch: (...args) => globalThis.fetch(...args),
  storage: browserStorage(),
  names: POOL_STATS_NAMES,
  maxPerRun: MAX_PER_RUN,
  timeoutMs: UPLOAD_TIMEOUT_MS,
});

let running = false;

/** Sends what is due; resolves to how many games were accepted or refused for good. Never throws. */
export async function runGlobalUpload(store: UploadStore, overrides: Partial<UploadDeps> = {}): Promise<number> {
  const deps = { ...defaultDeps(), ...overrides };
  if (running || !deps.baseUrl || readConsent(deps.storage) !== "on") return 0;
  running = true;
  try {
    const since = consentSince(deps.storage) ?? Number.POSITIVE_INFINITY;
    const sent = readSent(deps.storage);
    const due = (await store.listSaves())
      .filter(
        (meta) =>
          !meta.guided &&
          (meta.status === "won" || meta.status === "lost") &&
          !sent.has(meta.id) &&
          meta.updatedAt >= since,
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
      try {
        const response = await deps.fetch(`${deps.baseUrl}/global/result`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(result),
          signal: AbortSignal.timeout(deps.timeoutMs),
        });
        status = response.status;
      } catch {
        break;
      }
      if (status !== 200 && status !== 400) break;
      markSent([meta.id], deps.storage);
      done++;
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
    if (timer !== undefined) clearTimeout(timer);
    timer = setTimeout(run, debounceMs);
  });
  run();
  return () => {
    off();
    if (timer !== undefined) clearTimeout(timer);
  };
}
