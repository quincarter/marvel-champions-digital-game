/** One aspect's share on the donut and in its legend. */
export interface StatsAspectShare {
  readonly aspect: string;
  /** The aspect's printed name ("Justice"). */
  readonly label: string;
  /** The games brought to it; the ring's arc is its share of the total. */
  readonly games: number;
  /** The aspect's stamp colours (CSS). */
  readonly fill: string;
  /** "29% · 5 games · 60% won", already translated. */
  readonly text: string;
}

export interface McStatsAspectsDonutProps {
  /** The key the drawing is found by (`donut:aspects`). */
  chartKey: string;
  /** "ASPECTS", written in the ring's hole. */
  caption: string;
  shares: readonly StatsAspectShare[];
}
