/** One part of a segment bar. */
export interface SegmentBarPart {
  /** How many it stands for: the part's width is its share of the total. */
  readonly count: number;
  /** The part's fill, a CSS colour (a token variable or a hue). */
  readonly color: string;
  /** The words on the part, in the colour `ink`; drawn only when the bar has `labels` on. */
  readonly label?: string;
  /** The words' colour; left out, the ink. */
  readonly ink?: string;
}

export interface McSegmentBarProps {
  parts: readonly SegmentBarPart[];
  /** What the whole bar stands for, when more than the parts add up to (the rest stays empty); 0: their sum. */
  total: number;
  /** The bar's height in px. */
  height: number;
  /** Writes each part's label inside it. */
  labels: boolean;
}
