/** One arc of a donut. */
export interface DonutSlice {
  readonly value: number;
  /** A CSS colour. */
  readonly color: string;
}

export interface McDonutChartProps {
  slices: readonly DonutSlice[];
  /** The ring's outer diameter in px. */
  size: number;
  /** The ring's thickness in px. */
  thickness: number;
  /** The words in the hole, already translated. */
  center: string;
  /** The drawing's `data-key`, so a spec or a screen reader finds it. */
  chartKey: string;
}
