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
      /** "3 of 7 · 43%". */
      readonly count: string;
      /** Its achievements are listed under it; a folded family shows only this heading. */
      readonly expanded: boolean;
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

/** How the list is ordered (#479): the book's own order, how far along, what it is worth, or by name. */
export type TrophySort = "category" | "completion" | "points" | "name";

export const TROPHY_SORTS: readonly { readonly id: TrophySort; readonly label: string }[] = [
  { id: "category", label: "Category" },
  { id: "completion", label: "Complete %" },
  { id: "points", label: "Points" },
  { id: "name", label: "A–Z" },
];

/**
 * The player's view of the list: its order, and which families are open. Kept between visits
 * (`platform/trophy-room-view.ts`).
 */
export interface TrophyView {
  readonly sort: TrophySort;
  readonly descending: boolean;
  readonly expanded: ReadonlySet<AchievementFamily>;
}

/** Every family starts folded (#479), in the book's order. */
export const DEFAULT_TROPHY_VIEW: TrophyView = { sort: "category", descending: false, expanded: new Set() };

/** The book's order with every family open: the whole list, as `trophyRowsOf` gives it when asked for no view. */
export const ALL_OPEN_TROPHY_VIEW: TrophyView = {
  ...DEFAULT_TROPHY_VIEW,
  expanded: new Set(ACHIEVEMENT_FAMILIES.map((f) => f.id)),
};

/** "Complete % ▼", for the Filters button. */
export function trophySortLabel(view: Pick<TrophyView, "sort" | "descending">): string {
  const label = TROPHY_SORTS.find((s) => s.id === view.sort)?.label ?? "Category";
  return `${label} ${view.descending ? "▼" : "▲"}`;
}

/** How far along one achievement is: 1 once earned, else its bar's share, else 0. */
function completionOf(status: AchievementStatus): number {
  if (status.earned) return 1;
  const p = status.progress;
  return p && p.target > 0 ? Math.min(1, p.current / p.target) : 0;
}

/**
 * Orders `items` by `key` (numbers or names), ties in the book's order (`index`) whichever way the sort runs, so a
 * family of equals keeps the order a player learned.
 */
function ordered<T>(items: readonly T[], key: (item: T) => number | string, index: (item: T) => number, desc: boolean) {
  return [...items].sort((a, b) => {
    const ka = key(a);
    const kb = key(b);
    const by = typeof ka === "string" ? ka.localeCompare(kb as string) : ka - (kb as number);
    if (by !== 0) return desc ? -by : by;
    return index(a) - index(b);
  });
}

/**
 * The list's rows under `view`: a heading per family, sorted, with the family's achievements (sorted the same way)
 * under it when it is open. A family's completion is its earned share and its points the sum of what its achievements
 * are worth.
 */
export function trophyRowsOf(
  statuses: readonly AchievementStatus[],
  view: TrophyView = ALL_OPEN_TROPHY_VIEW,
): readonly TrophyRow[] {
  const rows: TrophyRow[] = [];
  const order = new Map(statuses.map((s, i) => [s.def.id, i]));
  const families = ACHIEVEMENT_FAMILIES.map((family, index) => {
    const members = statuses.filter((s) => s.def.family === family.id);
    const earned = members.filter((s) => s.earned).length;
    return {
      family,
      index,
      members,
      earned,
      completion: members.length > 0 ? earned / members.length : 0,
      points: members.reduce((sum, s) => sum + s.def.points, 0),
    };
  }).filter((f) => f.members.length > 0);
  const familyKey = (f: (typeof families)[number]): number | string =>
    view.sort === "completion"
      ? f.completion
      : view.sort === "points"
        ? f.points
        : view.sort === "name"
          ? f.family.label
          : f.index;
  const statusKey = (s: AchievementStatus): number | string =>
    view.sort === "completion"
      ? completionOf(s)
      : view.sort === "points"
        ? s.def.points
        : view.sort === "name"
          ? s.def.name
          : order.get(s.def.id)!;
  for (const f of ordered(families, familyKey, (x) => x.index, view.descending)) {
    const expanded = view.expanded.has(f.family.id);
    rows.push({
      kind: "section",
      id: f.family.id,
      title: f.family.label,
      count: `${f.earned} of ${f.members.length} · ${Math.round(f.completion * 100)}%`,
      expanded,
    });
    if (!expanded) continue;
    for (const status of ordered(f.members, statusKey, (s) => order.get(s.def.id)!, view.descending)) {
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
