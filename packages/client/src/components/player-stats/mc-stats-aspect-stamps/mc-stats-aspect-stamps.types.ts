/** One aspect of a hero's Cards by hero tab: its stamp, and what you did with it. */
export interface StatsAspectStamp {
  readonly aspect: string;
  /** The stamp's word ("JUSTICE"). */
  readonly label: string;
  /** The stamp's colours (CSS). */
  readonly fill: string;
  readonly ink: string;
  /** "5 games · 3 won". */
  readonly detail: string;
}

export interface McStatsAspectStampsProps {
  /** "ASPECTS". */
  caption: string;
  aspects: readonly StatsAspectStamp[];
}
