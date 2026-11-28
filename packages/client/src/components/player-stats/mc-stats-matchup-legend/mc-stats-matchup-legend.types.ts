/** One entry of the Matchups key: a swatch and a word for each look on show. */
export interface StatsLegendEntry {
  readonly kind: "tier" | "played" | "unplayed";
  readonly label: string;
  /** A tier's colour (CSS); empty for the two looks with no win. */
  readonly color: string;
}

export interface McStatsMatchupLegendProps {
  entries: readonly StatsLegendEntry[];
}
