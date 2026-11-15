/**
 * The progress math `refreshUnlocks` runs on every visit to Title and Extras, as one pure function of what it reads
 * (issue #722): achievement statuses, Extras progress, unlock progress and points, from the saves, the campaign runs
 * and the decks. The progress worker (`workers/progress.worker.ts`) runs it off the main thread, and the main thread
 * runs it as the fallback where there is no worker. Its result is plain data, small whatever the number of saves: the
 * main thread never holds the history it was measured from.
 */
import {
  achievementPointsOf,
  achievementStatuses,
  lifetimePointsOf,
  type AchievementHistory,
  type AchievementProgress,
  type AchievementStatus,
} from "./achievements.js";
import type { DeckFeats } from "./deck-feats.js";
import { extrasProgressOf, type ExtrasProgress } from "./extras.js";
import { progressOf, type UnlockProgress } from "./unlocks.js";

/** The saves `refreshUnlocks` lists (game metadata, from the engine worker). */
export type ProgressSaves = Parameters<typeof progressOf>[0] &
  Parameters<typeof extrasProgressOf>[0] &
  AchievementHistory["saves"];
/** The campaign runs it lists. */
export type ProgressCampaigns = Parameters<typeof progressOf>[1] &
  Parameters<typeof extrasProgressOf>[1] &
  AchievementHistory["campaigns"];

/** What only the main thread knows (local preferences, the packs loaded now): sent along with each refresh. */
export interface ProgressInputs {
  readonly howToPlay: { readonly done: number; readonly total: number };
  readonly unlockedEverything: boolean;
  readonly deckFeats: DeckFeats;
  readonly mods: NonNullable<AchievementHistory["mods"]>;
}

/** What is read from storage: the saves, the campaign runs, and whether a deck in your decks was built by you. */
export interface ProgressReads {
  readonly saves: ProgressSaves;
  readonly campaigns: ProgressCampaigns;
  readonly decksBuilt: boolean;
}

/** One achievement as measured: earned or not, and its progress bar when it has one. */
export interface MeasuredAchievement {
  readonly id: string;
  readonly earned: boolean;
  readonly progress: AchievementProgress | null;
}

export interface ProgressResult {
  /** Earned achievement ids, in definition order. */
  readonly earnedIds: readonly string[];
  readonly measured: readonly MeasuredAchievement[];
  readonly extrasProgress: ExtrasProgress;
  readonly progress: UnlockProgress;
  readonly achievementPoints: number;
  readonly lifetimePoints: number;
}

/** The history the achievements are measured from. */
export function historyOf(inputs: ProgressInputs, reads: ProgressReads): AchievementHistory {
  return {
    saves: reads.saves,
    campaigns: reads.campaigns,
    howToPlay: inputs.howToPlay,
    // The player's own switch, not the `?unlock=all` dev param.
    unlockedEverything: inputs.unlockedEverything,
    // A deck built before the feat was noted still counts while it is in your decks.
    decks: { ...inputs.deckFeats, built: inputs.deckFeats.built || reads.decksBuilt },
    mods: inputs.mods,
  };
}

/** Everything `refreshUnlocks` works out, from what it read. */
export function computeProgress(inputs: ProgressInputs, reads: ProgressReads): ProgressResult {
  const history = historyOf(inputs, reads);
  const statuses = achievementStatuses(history);
  const earnedIds = statuses.filter((status) => status.earned).map((status) => status.def.id);
  return {
    earnedIds,
    measured: statuses.map((status) => ({ id: status.def.id, earned: status.earned, progress: status.progress })),
    extrasProgress: extrasProgressOf(reads.saves, reads.campaigns, earnedIds),
    progress: progressOf(reads.saves, reads.campaigns),
    achievementPoints: achievementPointsOf(history),
    lifetimePoints: lifetimePointsOf(history),
  };
}

/**
 * The achievement statuses for the Trophy Room and the toast, from a result: every definition (the built-in ones and
 * the packs' own, which only need the main-thread inputs) with what the result measured for it.
 */
export function statusesOf(
  inputs: ProgressInputs,
  measured: readonly MeasuredAchievement[],
): readonly AchievementStatus[] {
  const byId = new Map(measured.map((one) => [one.id, one]));
  return achievementStatuses(definitionsHistoryOf(inputs)).map((status) => {
    const one = byId.get(status.def.id);
    return one ? { def: status.def, earned: one.earned, progress: one.progress } : { ...status, earned: false };
  });
}

/** A history with no saves or runs: enough to list every definition, the packs' included. */
export function definitionsHistoryOf(inputs: ProgressInputs): AchievementHistory {
  return historyOf(inputs, { saves: [], campaigns: [], decksBuilt: false });
}
