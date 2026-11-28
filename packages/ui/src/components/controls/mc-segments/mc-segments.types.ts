/** One cell of `mc-segments`. */
export interface McSegmentOption {
  /** The cell's focus stop (`data-stop`). */
  readonly stop: string;
  readonly label: string;
  /** A tile's second line. */
  readonly detail?: string;
  readonly selected: boolean;
  /** What a tap raises (`mc-pressed`). */
  readonly action: unknown;
}
