import type { PictureSource } from "@mc/ui";

/** One hero's or set's tile in the Focus view: its picture, a ribbon saying what you did, its name. */
export interface StatsMatchupTileModel {
  /** The grid column: the focus stop is `tile:<column>`. */
  readonly column: number;
  readonly name: string;
  readonly look: "won" | "played" | "unplayed";
  /** "Expert", "Tried", "Not played"; with counts, "Expert · 3". */
  readonly ribbon: string;
  /** The tier's colour and the ink that reads on it (CSS), for a won tile. */
  readonly color: string;
  readonly ink: string;
  readonly picture: PictureSource | null;
  readonly cardId: string | null;
}

export interface McStatsMatchupTileProps {
  tile: StatsMatchupTileModel | null;
}
