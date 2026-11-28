/** The Trophy Room's focus stop keys and their order: the bar, the filters, then every heading and achievement. */
import type { TrophyRow } from "../../view/trophy-room-model.js";

/** An achievement's stop, by its id: the same achievement keeps it however the list folds or sorts. */
export const keyOfAchievementRow = (id: string): string => `row:${id}`;

/** A row's stop key: a heading's, an achievement's, or (a pack's label, which is no stop) its own `grp:` name. */
export const keyOfTrophyRow = (row: TrophyRow): string =>
  row.kind === "section" ? `sec:${row.id}` : row.kind === "group" ? `grp:${row.id}` : keyOfAchievementRow(row.id);

/**
 * The order the route walks: Back, Your stats, the Filters button and Expand all, the sort chips while the filters are
 * open, then each family's heading and, under an open one, its achievements. A pack's label is not a stop. Only keys the
 * page really drew (`present`) are listed.
 */
export function trophyStopOrder(
  rows: readonly TrophyRow[],
  filtersOpen: boolean,
  present: readonly string[],
): readonly string[] {
  const here = new Set(present);
  const wanted = [
    "back",
    "stats",
    "filters-toggle",
    "expand-all",
    ...(filtersOpen ? ["sort:category", "sort:completion", "sort:points", "sort:name", "dir:asc", "dir:desc"] : []),
    ...rows.flatMap((row) => {
      return row.kind === "group" ? [] : [keyOfTrophyRow(row)];
    }),
  ];
  return wanted.filter((key) => here.has(key));
}
