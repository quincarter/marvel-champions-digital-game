/** One line of the file's words. A quote (a line that opens with a quotation mark) is set in italics. */
export interface ViewerLine {
  readonly text: string;
  readonly quote: boolean;
}

/** A promo card's use-this-art control. */
export interface ViewerPromo {
  /** "Use this art", or "In use - Stop using". */
  readonly label: string;
  /** Said under the button while promo art is off in Settings; null when it is on. */
  readonly off: string | null;
}

export interface McViewerTextProps {
  /** The hero's or villain's second line, or "". */
  subtitle: string;
  lines: readonly ViewerLine[];
  promo: ViewerPromo | null;
  /** "1 more picture to earn: Beat Rhino", or "". */
  note: string;
  /** Beside the picture (the larger type) rather than under it. */
  wide: boolean;
}
