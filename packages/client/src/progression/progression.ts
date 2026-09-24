/**
 * The app's one `Unlocks` (`unlocks.ts`): progress read from the game and campaign stores, the player's own
 * unlock preferences, and the `?unlock=all` dev param.
 *
 * Screens read `unlocks()` synchronously while drawing and call `refreshUnlocks()` when they open; Boot awaits one
 * refresh before Title, so the first screen a player sees already knows what they have earned. A refresh returns
 * whether anything changed, so a screen redraws only when it has to.
 *
 * The preferences live in `localStorage` (`mc-unlocks`), not IndexedDB: a few bytes read once at startup. Where
 * `localStorage` is missing or throws (Vitest, a locked-down webview), they fall back to the defaults for the
 * session.
 */
import { appSession, campaignService } from "../session.js";
import { Extras, NO_EXTRAS_PROGRESS, extrasProgressOf, type ExtrasProgress } from "./extras.js";
import {
  NO_PROGRESS,
  UNLOCK_PREFS_VERSION,
  Unlocks,
  devUnlockAllFrom,
  parseUnlockPrefs,
  progressOf,
  sameProgress,
  type UnlockPrefs,
  type UnlockProgress,
} from "./unlocks.js";

const PREFS_KEY = "mc-unlocks";

function readPrefs(): UnlockPrefs {
  try {
    return parseUnlockPrefs(globalThis.localStorage?.getItem(PREFS_KEY) ?? null);
  } catch {
    return parseUnlockPrefs(null);
  }
}

function writePrefs(prefs: UnlockPrefs): void {
  try {
    globalThis.localStorage?.setItem(PREFS_KEY, JSON.stringify({ version: UNLOCK_PREFS_VERSION, ...prefs }));
  } catch {
    // Private mode or a full quota: the choice still holds for this session.
  }
}

const devUnlockAll = typeof location !== "undefined" && devUnlockAllFrom(location.search);

let progress: UnlockProgress = NO_PROGRESS;
let prefs: UnlockPrefs | null = null;
let current: Unlocks | null = null;
let extrasProgress: ExtrasProgress = NO_EXTRAS_PROGRESS;
let currentExtras: Extras | null = null;

export function unlocks(): Unlocks {
  prefs ??= readPrefs();
  current ??= new Unlocks({ progress, prefs, devUnlockAll });
  return current;
}

/** What the Extras screen may show (`extras.ts`), from the same reads; everything is open while `unlocks()` says so. */
export function extras(): Extras {
  currentExtras ??= new Extras(extrasProgress, { everything: unlocks().everything });
  return currentExtras;
}

/**
 * Re-reads progress from storage. True when the unlocks changed since the last read; Extras progress is refreshed by
 * the same read, and the Extras screen redraws after it regardless.
 */
export async function refreshUnlocks(): Promise<boolean> {
  const [saves, campaigns] = await Promise.all([
    appSession().store.listSaves(),
    campaignService()
      .storage.list()
      .catch(() => []),
  ]);
  const nextExtras = extrasProgressOf(saves, campaigns);
  if (JSON.stringify(nextExtras) !== JSON.stringify(extrasProgress)) {
    extrasProgress = nextExtras;
    currentExtras = null;
  }
  const next = progressOf(saves, campaigns);
  if (sameProgress(next, progress)) return false;
  progress = next;
  current = null;
  currentExtras = null;
  return true;
}

/** Saves new preferences and applies them at once. */
export function setUnlockPrefs(next: UnlockPrefs): void {
  prefs = next;
  current = null;
  currentExtras = null;
  writePrefs(next);
}
