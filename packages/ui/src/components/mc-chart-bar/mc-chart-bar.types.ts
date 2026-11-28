/** The properties of `mc-chart-bar`: one bar and its label. */
export interface McChartBarProps {
  /** The label under the bar. */
  label: string;
  /** What the bar stands for. */
  count: number;
  /** The largest count in the chart: the bar's height is `count / max` of the room above the label. */
  max: number;
  /** Stands out (a deck's commonest cost): red rather than ink. */
  highlight: boolean;
  /** A CSS colour of its own, in place of the ink or red; empty keeps them. */
  tint: string;
}
