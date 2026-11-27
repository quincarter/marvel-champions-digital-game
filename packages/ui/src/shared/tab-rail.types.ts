/** One tab of a rail. */
export interface TabRailTab {
  /** What `mc-activate` reports (as `detail.id`), and what the cell's `data-key` is after the rail's `prefix`. */
  readonly id: string;
  /** The tab's name, already translated. */
  readonly label: string;
  /** The chosen tab. A rail can name the chosen id instead (`selected` on the rail); either one marks the cell. */
  readonly selected?: boolean;
  /** Unavailable (dashed, no press); a string is the reason a tooltip gives. `false` is the same as absent. */
  readonly disabled?: string | boolean;
  /** A count shown on a tab that is not selected ("3 changed"): a count, never a bare dot. */
  readonly badge?: number;
}
