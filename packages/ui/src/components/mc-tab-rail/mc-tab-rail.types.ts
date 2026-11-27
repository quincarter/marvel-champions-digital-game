/** One tab of a rail. */
export interface TabRailTab {
  /** What `mc-activate` reports (as `detail.id`), and what the cell's `data-key` is after the rail's `prefix`. */
  readonly id: string;
  /** The tab's name, already translated. */
  readonly label: string;
  readonly selected?: boolean;
  /** Unavailable (dashed, no press), with the reason a tooltip gives. */
  readonly disabled?: string | true;
  /** A count shown on a tab that is not selected ("3 changed"): a count, never a bare dot. */
  readonly badge?: number;
}
