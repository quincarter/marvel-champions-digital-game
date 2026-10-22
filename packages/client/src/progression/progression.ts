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
import { setShownStandIns } from "../art/art-source.js";
import { guidePrefs } from "../guide/guide-store.js";
import { howToPlayProgressOf } from "../view/how-to-play-model.js";
import { appSession, campaignService, deckStorage } from "../session.js";
import { notifySaveDataChanged } from "../sync/save-data-changed.js";
import { readDeckFeats } from "./deck-feats.js";
import {
  NO_HISTORY,
  achievementPointsOf,
  achievementStatuses,
  isAchievementEarned,
  lifetimePointsOf,
  type AchievementHistory,
} from "./achievements.js";
import { earnedItemIdsOf, shownStandInsOf, type EarnedItemId } from "./earned-items.js";
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
/** Set once "Unlock everything" has been on, for the achievement that names it (kept after it is turned off). */
const UNLOCKED_EVERYTHING_KEY = "mc-unlocked-everything";

function unlockedEverythingEver(on: boolean): boolean {
  try {
    // Written and announced only when the stored value changes, so reading progress never triggers a sync.
    if (on && globalThis.localStorage?.getItem(UNLOCKED_EVERYTHING_KEY) !== "1") {
      globalThis.localStorage?.setItem(UNLOCKED_EVERYTHING_KEY, "1");
      notifySaveDataChanged("progress");
    }
    return on || globalThis.localStorage?.getItem(UNLOCKED_EVERYTHING_KEY) === "1";
  } catch {
    return on;
  }
}

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
    notifySaveDataChanged("progress");
  } catch {
    // Private mode or a full quota: the choice still holds for this session.
  }
}

const devUnlockAll = typeof location !== "undefined" && devUnlockAllFrom(location.search);

let progress: UnlockProgress = NO_PROGRESS;
let history: AchievementHistory = NO_HISTORY;
/** Ids earned as of the last refresh, in definition order; null until a refresh has read the stores. */
let earnedIds: readonly string[] | null = null;
let achievementPoints = 0;
let lifetimePoints = 0;
let prefs: UnlockPrefs | null = null;
let current: Unlocks | null = null;
let extrasProgress: ExtrasProgress = NO_EXTRAS_PROGRESS;
let currentExtras: Extras | null = null;

export function unlocks(): Unlocks {
  prefs ??= readPrefs();
  current ??= new Unlocks({ progress, prefs, devUnlockAll, achievementPoints });
  return current;
}

/** The save history the Trophy Room reads achievements from (`achievements.ts`), as of the last refresh. */
export function achievementHistory(): AchievementHistory {
  return history;
}

/**
 * The achievements earned as of the last refresh, in definition order (what the "Achievement unlocked" popup compares
 * against what it has announced), or null before any refresh has read the stores, so a failed first read never
 * passes for "nothing earned".
 */
export function earnedAchievementIds(): readonly string[] | null {
  return earnedIds;
}

/** Lifetime champion points as of the last refresh: what rank reads, never lowered by spending. */
export function lifetimeChampionPoints(): number {
  return lifetimePoints;
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
  const [saves, campaigns, savedDecks] = await Promise.all([
    appSession().store.listSaves(),
    campaignService()
      .storage.list()
      .catch(() => []),
    deckStorage()
      .list()
      .catch(() => []),
  ]);
  const deckFeats = readDeckFeats();
  const nextHistory = {
    saves,
    campaigns,
    howToPlay: howToPlayProgressOf(guidePrefs()),
    // The player's own switch, not the `?unlock=all` dev param.
    unlockedEverything: unlockedEverythingEver((prefs ?? readPrefs()).unlockAll),
    // A deck built before the feat was noted still counts while it is in your decks.
    decks: { ...deckFeats, built: deckFeats.built || savedDecks.some((deck) => deck.source.kind === "userBuilt") },
  };
  const nextEarned = achievementStatuses(nextHistory)
    .filter((status) => status.earned)
    .map((status) => status.def.id);
  earnedIds = nextEarned;
  const nextExtras = extrasProgressOf(saves, campaigns, nextEarned);
  if (JSON.stringify(nextExtras) !== JSON.stringify(extrasProgress)) {
    extrasProgress = nextExtras;
    currentExtras = null;
  }
  history = nextHistory;
  lifetimePoints = lifetimePointsOf(history);
  const next = progressOf(saves, campaigns);
  const nextAchievementPoints = achievementPointsOf(history);
  if (sameProgress(next, progress) && nextAchievementPoints === achievementPoints) {
    applyEarnedItems();
    return false;
  }
  progress = next;
  achievementPoints = nextAchievementPoints;
  current = null;
  currentExtras = null;
  applyEarnedItems();
  return true;
}

/**
 * Device sync wrote `mc-unlocks` (or `mc-unlocked-everything`): forgets the cached preferences and what is built from
 * them, so `unlocks()` and the next `setUnlockPrefs` start from what is stored. Call `refreshUnlocks()` after for progress.
 */
export function dropUnlockCaches(): void {
  prefs = null;
  current = null;
  currentExtras = null;
}

/** The earned items this player has (`earned-items.ts`): their achievements, from the same reads as `unlocks()`. */
export function earnedItems(): ReadonlySet<EarnedItemId> {
  return earnedItemIdsOf((id) => isAchievementEarned(id, history), unlocks().everything);
}

/** Tells the art which earned pictures to draw: call after progress, unlock preferences or settings change. */
export function applyEarnedItems(): void {
  setShownStandIns(shownStandInsOf(earnedItems(), appSession().settings));
}

/** Saves new preferences and applies them at once. */
export function setUnlockPrefs(next: UnlockPrefs): void {
  prefs = next;
  current = null;
  currentExtras = null;
  writePrefs(next);
  applyEarnedItems();
  // "Unlock everything" turned on earns its achievement: read again so the popup sees it.
  if (next.unlockAll) void refreshUnlocks().catch(() => false);
}
