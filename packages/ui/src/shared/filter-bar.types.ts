/** One chip of a filter bar. */
export interface FilterChip {
  /** What `mc-activate` reports after the bar's `prefix` (and the cell's `data-key`). */
  readonly id: string;
  readonly label: string;
  /** How many items it would match, shown on a chip that is not chosen. */
  readonly count?: number;
  readonly selected: boolean;
  /** The chip's width in px (the client measured its label). */
  readonly width: number;
  /** False for a chip that carries its own mark ("by X ✕", Clear): no "✓ " when chosen. */
  readonly mark?: boolean;
}
