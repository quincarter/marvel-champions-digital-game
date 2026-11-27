/** One line of words in a tile, a row or a panel: one line high, shrinking to fit its width and then cut with an ellipsis. */
export interface TextLine {
  readonly text: string;
  /** Font size in px; 12 or less grows on desktop with every other small size. */
  readonly size: number;
  /** The line's box height in px (its pitch). */
  readonly height: number;
  readonly weight?: number;
  readonly opacity?: number;
  /** A label's capitals and tracking. */
  readonly label?: boolean;
}
