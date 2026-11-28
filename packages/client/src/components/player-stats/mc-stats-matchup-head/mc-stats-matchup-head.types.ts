import type { PictureSource } from "@mc/ui";

/** A row's or a column's name on the Matchups grid, with its picture on the stamp grid. */
export interface StatsGridAxisModel {
  readonly name: string;
  /** The picture the stamp grid shows; null with none (a modular set has none) and on the heat grid. */
  readonly picture: PictureSource | null;
  /** The card the picture stands for, for the hover; null for none. */
  readonly cardId: string | null;
}

export interface McStatsMatchupHeadProps {
  axis: "row" | "column";
  /** `heat` shows the name alone (a column's stands on end); `stamps` leads with the picture. */
  kind: "heat" | "stamps";
  entry: StatsGridAxisModel | null;
  /** The cursor is in this row or column: the header is tinted, so a cell is read back to its two names. */
  cursor: boolean;
}
