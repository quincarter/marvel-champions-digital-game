import type { PictureSource, SegmentBarPart } from "@mc/ui";

/** One pip of a shelf: a hero or set, as a tier's colour, an outline (played) or an empty square. */
export interface StatsShelfPip {
  readonly kind: "tier" | "played" | "unplayed";
  readonly color: string;
}

/** A villain's shelf in the Shelves view. */
export interface StatsShelfModel {
  /** The grid row it stands for: its press opens the Focus view on that row. */
  readonly row: number;
  readonly name: string;
  /** "9 of 63 beaten · 3 tried", and its short form for a phone. */
  readonly summary: string;
  readonly short: string;
  /** Wins by tier as a bar, over `total` columns. */
  readonly bar: readonly SegmentBarPart[];
  readonly total: number;
  readonly pips: readonly StatsShelfPip[];
  /** The hardest tier beaten, as a badge ("Expert"), or empty. */
  readonly best: string;
  readonly bestColor: string;
  readonly bestInk: string;
  readonly picture: PictureSource | null;
  /** The card the picture stands for, for the hover; null for none. */
  readonly cardId: string | null;
}

export interface McStatsMatchupShelfProps {
  shelf: StatsShelfModel | null;
}
