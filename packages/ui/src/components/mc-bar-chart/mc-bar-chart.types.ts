/** One bar of a chart: its label under it, its count and whether it stands out (a deck's most common cost). */
export interface BarChartBar {
  readonly label: string;
  readonly count: number;
  readonly highlight: boolean;
  /** A colour of its own for the bar (a CSS colour), in place of the ink or red; left out, the bar is as it was. */
  readonly tint?: string;
}
