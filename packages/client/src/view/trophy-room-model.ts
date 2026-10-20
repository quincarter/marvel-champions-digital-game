/**
 * The Trophy Room (`scenes/trophy-room.ts`), as plain data: the rank header and one list of rows, every achievement
 * grouped by family (docs/achievements.md). What is earned, and the rank, is `progression/achievements.ts`'s; this
 * module only words and orders it. State is always a word as well as a look (EARNED / LOCKED / SOON), never color alone.
 */
import {
  ACHIEVEMENT_FAMILIES,
  rankProgressOf,
  type AchievementFamily,
  type AchievementStatus,
} from "../progression/achievements.js";

export type TrophyState = "earned" | "locked" | "untracked";

export interface TrophyHeader {
  /** "Rank 3 of 9". */
  readonly rankLabel: string;
  readonly title: string;
  /** "1,250 lifetime points". */
  readonly pointsLabel: string;
  /** 0 to 1 toward the next rank; 1 at the top. */
  readonly fraction: number;
  /** "300 to Street-Level Legend" or "Top rank". */
  readonly nextLabel: string;
  /** "12 of 140 achievements". */
  readonly earnedLabel: string;
}

export type TrophyRow =
  | {
      readonly kind: "section";
      readonly id: AchievementFamily;
      readonly title: string;
      /** "3 of 7". */
      readonly count: string;
    }
  | {
      readonly kind: "achievement";
      readonly id: string;
      readonly name: string;
      /** What it takes (a locked one says how to earn it), or the "Tracked from a future update" note. */
      readonly detail: string;
      readonly state: TrophyState;
      /** "EARNED", "LOCKED" or "SOON". */
      readonly stateLabel: string;
      /** "+25 points" or "Silly pack"; empty for none. */
      readonly reward: string;
      readonly progress: { readonly current: number; readonly target: number; readonly fraction: number } | null;
      /** "3 / 10". */
      readonly progressLabel: string;
    };

export const TRACKED_LATER = "Tracked from a future update";

/** 1250 becomes "1,250": a fixed grouping, so a screenshot reads the same in any locale. */
export const formatTrophyNumber = (n: number): string => String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ",");

export function trophyHeaderOf(lifetimePoints: number, statuses: readonly AchievementStatus[]): TrophyHeader {
  const progress = rankProgressOf(lifetimePoints);
  const earned = statuses.filter((s) => s.earned).length;
  return {
    rankLabel: `Rank ${progress.rank.rank} of 9`,
    title: progress.rank.title,
    pointsLabel: `${formatTrophyNumber(lifetimePoints)} lifetime points`,
    fraction: progress.fraction,
    nextLabel: progress.next
      ? `${formatTrophyNumber(progress.next.threshold - lifetimePoints)} to ${progress.next.title}`
      : "Top rank",
    earnedLabel: `${earned} of ${statuses.length} achievements`,
  };
}

function rewardOf(status: AchievementStatus): string {
  if (status.def.points > 0) return `+${status.def.points} points`;
  return status.def.rewardPackId ? "Silly pack" : "";
}

export function trophyRowsOf(statuses: readonly AchievementStatus[]): readonly TrophyRow[] {
  const rows: TrophyRow[] = [];
  for (const family of ACHIEVEMENT_FAMILIES) {
    const inFamily = statuses.filter((s) => s.def.family === family.id);
    if (inFamily.length === 0) continue;
    rows.push({
      kind: "section",
      id: family.id,
      title: family.label,
      count: `${inFamily.filter((s) => s.earned).length} of ${inFamily.length}`,
    });
    // Earned ones first would reorder a list the player learns by position; keep the definition order.
    for (const status of inFamily) {
      const state: TrophyState = !status.def.tracked ? "untracked" : status.earned ? "earned" : "locked";
      const progress = status.progress
        ? {
            current: status.progress.current,
            target: status.progress.target,
            fraction: status.progress.target > 0 ? Math.min(1, status.progress.current / status.progress.target) : 0,
          }
        : null;
      rows.push({
        kind: "achievement",
        id: status.def.id,
        name: status.def.name,
        detail: state === "untracked" ? `${status.def.description} ${TRACKED_LATER}.` : status.def.description,
        state,
        stateLabel: state === "earned" ? "EARNED" : state === "locked" ? "LOCKED" : "SOON",
        reward: rewardOf(status),
        progress,
        progressLabel: progress ? `${progress.current} / ${progress.target}` : "",
      });
    }
  }
  return rows;
}

/** Row heights: a family heading is slim; an achievement takes a line more on a phone, where its text wraps. */
export function trophyRowHeightsOf(phone: boolean): { readonly section: number; readonly achievement: number } {
  return phone ? { section: 44, achievement: 108 } : { section: 46, achievement: 84 };
}
