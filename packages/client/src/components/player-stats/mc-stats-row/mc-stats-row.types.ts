import type { PictureSource, SegmentBarPart } from "@mc/ui";

/** One stat row of a list tab, as the view model words it. */
export interface StatsRowModel {
  /** The row's id: its focus stop is `row:<id>`. */
  readonly id: string;
  readonly label: string;
  /** The figure at the right ("4–1", "71%"). */
  readonly value: string;
  /** A second line under the label, or empty. */
  readonly detail: string;
  /** A headline fact (a favorite, a best): drawn filled. */
  readonly highlight: boolean;
  /** The card the row is about: its picture leads the row and opens the card hover; absent on a row about no one card. */
  readonly cardId: string | null;
  readonly picture: PictureSource | null;
  /** The saved game the row's number came from, when Game review can show it; its press opens that game. */
  readonly gameId: string | null;
  /** "View game ▸", already translated, drawn when `gameId` is set. */
  readonly linkLabel: string;
  /** Why the row's games were lost: a stacked bar, with its words beside or under it. */
  readonly losses: readonly SegmentBarPart[];
  readonly lossLegend: string;
}

export interface McStatsRowProps {
  row: StatsRowModel | null;
}
