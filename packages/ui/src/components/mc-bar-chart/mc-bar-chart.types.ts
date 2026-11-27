/** One bar of a chart: its label under it, its count and whether it stands out (a deck's most common cost). */
export interface BarChartBar {
  readonly label: string;
  readonly count: number;
  readonly highlight: boolean;
}
