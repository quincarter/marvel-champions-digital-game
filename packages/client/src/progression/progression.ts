/**
 * The app's one `Unlocks` (`unlocks.ts`): progress read from the game and campaign stores, the player's own
 * unlock preferences, and the `?unlock=all` dev param.
 *
 * Screens read `unlocks()` synchronously while drawing and call `refreshUnlocks()` when they open; Boot awaits one
 * refresh before Title (for up to six seconds, #871), so the first screen a player sees already knows what they have earned. A refresh returns
 * whether anything changed, so a screen redraws only when it has to.
 *
 * The preferences live in `localStorage` (`mc-unlocks`), not IndexedDB: a few bytes read once at startup. Where
 * `localStorage` is missing or throws (Vitest, a locked-down webview), they fall back to the defaults for the
 * session.
 */
import { setShownPromos, setShownStandIns } from "../art/art-source.js";
import { PROMO_SETS, promoArtByScan, type PromoSet } from "../art/promo-art.js";
import { guidePrefs } from "../guide/guide-store.js";
import { howToPlayProgressOf } from "../view/how-to-play-model.js";
import { appSession, campaignService, deckStorage } from "../session.js";
import { notifySaveDataChanged } from "../sync/save-data-changed.js";
import { parsePackAchievements } from "@mc/content";
import { IdbPackStore, type InstalledPack } from "../packs/pack-store.js";
import { loadedPacks, onLoadedPacksChange } from "../packs/pack-registry.js";
import { noteModInstalls, readModInstalls } from "./mod-installs.js";
import { readDeckFeats } from "./deck-feats.js";
import {
  NO_HISTORY,
  achievementDefOf,
  achievementStatuses,
  type AchievementDef,
  type AchievementStatus,
} from "./achievements.js";
import {
  computeProgress,
  definitionsHistoryOf,
  statusesOf,
  type MeasuredAchievement,
  type ProgressCampaigns,
  type ProgressInputs,
  type ProgressResult,
  type ProgressSaves,
} from "./progress-compute.js";
import { progressOffMain } from "./progress-client.js";
import { earnedItemIdsOf, shownStandInsOf, type EarnedItemId } from "./earned-items.js";
import { Extras, NO_EXTRAS_PROGRESS, type ExtrasProgress } from "./extras.js";
import {
  NO_PROGRESS,
  UNLOCK_PREFS_VERSION,
  Unlocks,
  devUnlockAllFrom,
  parseUnlockPrefs,
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
/** What the main thread passed to the last refresh (prefs, packs): the definitions are listed from it. */
let progressInputs: ProgressInputs | null = null;
/** Each achievement as the last refresh measured it. */
let measured: readonly MeasuredAchievement[] = [];
let statusesCache: readonly AchievementStatus[] | null = null;
/** Refreshes started, and the newest one whose result is in. */
let refreshesStarted = 0;
let refreshApplied = 0;
/** Bumped by every refresh that changed the unlocks, so a refresh can tell whether another one changed them meanwhile. */
let unlocksVersion = 0;
/** Ids earned as of the last refresh, in definition order; null until a refresh has read the stores. */
let earnedIds: readonly string[] | null = null;
/** Told after each refresh whose result is applied (`onProgressRead`). */
const readListeners = new Set<(changed: boolean) => void>();

/**
 * Calls `listener` after every refresh whose result is applied, with whether the unlocks changed. For a screen that
 * may be up before the read it needs lands: Boot goes on to Title after a few seconds without it (#871), and its read
 * can land after Title's own. Returns the unsubscribe.
 */
export function onProgressRead(listener: (changed: boolean) => void): () => void {
  readListeners.add(listener);
  return () => readListeners.delete(listener);
}

function progressRead(changed: boolean): boolean {
  for (const listener of [...readListeners]) listener(changed);
  return changed;
}
let achievementPoints = 0;
let lifetimePoints = 0;
let prefs: UnlockPrefs | null = null;
let current: Unlocks | null = null;
let extrasProgress: ExtrasProgress = NO_EXTRAS_PROGRESS;
let currentExtras: Extras | null = null;

// A pack installed, updated or removed changes which mods are noted and which pack achievements are listed.
onLoadedPacksChange(() => void refreshUnlocks().catch(() => false));

export function unlocks(): Unlocks {
  prefs ??= readPrefs();
  current ??= new Unlocks({ progress, prefs, devUnlockAll, achievementPoints });
  return current;
}

/**
 * Every achievement as of the last refresh, earned or not, with its progress: what the Trophy Room lists. Measured off
 * the main thread where it can be (issue #722), so the main thread holds the result, never the save history.
 */
export function achievementStatusesNow(): readonly AchievementStatus[] {
  statusesCache ??= progressInputs ? statusesOf(progressInputs, measured) : achievementStatuses(NO_HISTORY);
  return statusesCache;
}

/** One achievement's definition, a pack's own included (what the "Achievement unlocked" toast shows). */
export function achievementDefNow(id: string): AchievementDef | undefined {
  return achievementDefOf(id, progressInputs ? definitionsHistoryOf(progressInputs) : NO_HISTORY);
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

/** One read-only handle on the pack store for the install record: it only lists, the Mod Store has its own. */
let modInstallStore: IdbPackStore | undefined;
function modInstalls(): Promise<InstalledPack[]> {
  if (typeof indexedDB === "undefined") return Promise.resolve([]);
  modInstallStore ??= new IdbPackStore();
  return modInstallStore.list();
}

/**
 * Re-reads progress from storage. True when the unlocks changed since this refresh started, by this read or by another
 * that landed meanwhile (#871: Boot's read can land while a screen's own is in flight, and that screen drew before
 * either); Extras progress is refreshed by the same read, and the Extras screen redraws after it regardless.
 */
export async function refreshUnlocks(): Promise<boolean> {
  const refresh = ++refreshesStarted;
  const versionAtStart = unlocksVersion;
  const saves = (await appSession().store.listSaves()) as ProgressSaves;
  // Mods (docs/custom-content-packs.md section 11.12): every installed pack is noted once, for good, so removing a mod
  // never takes its install achievements back. The achievements of the packs loaded now come from the loaded runtimes.
  const installedPacks = await modInstalls().catch((): InstalledPack[] => []);
  noteModInstalls(installedPacks.map((pack) => ({ id: pack.id, kind: pack.manifest.kind })));
  const inputs: ProgressInputs = {
    howToPlay: howToPlayProgressOf(guidePrefs()),
    // The player's own switch, not the `?unlock=all` dev param.
    unlockedEverything: unlockedEverythingEver((prefs ?? readPrefs()).unlockAll),
    deckFeats: readDeckFeats(),
    mods: {
      installed: readModInstalls(),
      // Every installed pack's list, active or not (a pack switched off keeps its locked rows); a loaded runtime wins.
      packs: [
        ...loadedPacks().map((pack) => ({
          id: pack.id,
          name: pack.name,
          achievements: pack.achievements ?? [],
          installed: true,
        })),
        ...installedPacks
          .filter((pack) => !loadedPacks().some((one) => one.id === pack.id))
          .map((pack) => ({
            id: pack.id,
            name: pack.manifest.name,
            achievements: parsePackAchievements(pack.manifest.achievements),
            installed: true,
          })),
      ],
    },
  };
  // The campaign and deck reads and the math run in the progress worker (issue #722); here only where it can't.
  const result = (await progressOffMain(inputs, saves)) ?? (await progressOnMain(inputs, saves));
  // A refresh started earlier but finished later (two in flight: Title's and a pack change's) never rolls back a newer one.
  if (refresh < refreshApplied) return unlocksVersion !== versionAtStart;
  refreshApplied = refresh;
  progressInputs = inputs;
  measured = result.measured;
  statusesCache = null;
  earnedIds = result.earnedIds;
  if (JSON.stringify(result.extrasProgress) !== JSON.stringify(extrasProgress)) {
    extrasProgress = result.extrasProgress;
    currentExtras = null;
  }
  lifetimePoints = result.lifetimePoints;
  const next = result.progress;
  const nextAchievementPoints = result.achievementPoints;
  if (sameProgress(next, progress) && nextAchievementPoints === achievementPoints) {
    applyEarnedItems();
    progressRead(false);
    return unlocksVersion !== versionAtStart;
  }
  progress = next;
  achievementPoints = nextAchievementPoints;
  current = null;
  currentExtras = null;
  unlocksVersion++;
  applyEarnedItems();
  return progressRead(true);
}

/** The fallback: the same reads and math as the progress worker, on the main thread. */
async function progressOnMain(inputs: ProgressInputs, saves: ProgressSaves): Promise<ProgressResult> {
  const [campaigns, savedDecks] = await Promise.all([
    campaignService()
      .storage.list()
      .catch(() => []),
    deckStorage()
      .list()
      .catch(() => []),
  ]);
  return computeProgress(inputs, {
    saves,
    campaigns: campaigns as unknown as ProgressCampaigns,
    decksBuilt: savedDecks.some((deck) => deck.source.kind === "userBuilt"),
  });
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
  return earnedItemIdsOf(
    (id) => earnedIds?.includes(id) ?? false,
    unlocks().everything,
    PROMO_SETS.some((set) => extras().isOpen(set.earn)),
  );
}

/** The promo sets this player has earned. */
export function earnedPromoSets(): readonly PromoSet[] {
  return PROMO_SETS.filter((set) => extras().isOpen(set.earn));
}

/** The promo sets to draw: earned, picked, and promo card art switched on. */
function shownPromoSets(): readonly PromoSet[] {
  const { promoArt, promoArtOn } = appSession().settings;
  return promoArtOn ? earnedPromoSets().filter((set) => promoArt.includes(set.id)) : [];
}

/** Tells the art which earned pictures to draw: call after progress, unlock preferences or settings change. */
export function applyEarnedItems(): void {
  setShownStandIns(shownStandInsOf(earnedItems(), appSession().settings));
  setShownPromos(promoArtByScan(shownPromoSets()));
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
