/** One toggle chip of a filter bar: a word, an optional count, and whether it is on. */
export interface FilterChip {
  /** What `mc-activate` reports after the bar prefix (as `detail.id` and in the cell `data-key`). */
  readonly id: string;
  /** The chip name, already translated. */
  readonly label: string;
  /** How many items it would match: shown on a chip that is not chosen (on a chosen one too with `countAlways`). */
  readonly count?: number;
  readonly selected: boolean;
  /** Unavailable: dimmed and dashed, no press; a string is the reason a tooltip gives. */
  readonly disabled?: string | boolean;
  /** The width in px when the client measured the label (a packed bar); absent, the chip is as wide as its words. */
  readonly width?: number;
  /** False for a chip that carries its own mark ("by X ✕", Clear): no check before it when chosen. */
  readonly mark?: boolean;
  /** The chip rests in these colors (CSS colors: an aspect's printed frame fill and the word's ink); chosen it is the ink fill as ever. */
  readonly tint?: { readonly fill: string; readonly ink: string };
  /**
   * A second segment at the chip's right end, a button of its own (the aspect chips' "i" that opens a tip): a tap on it
   * raises `mc-info` rather than `mc-activate`. `open` is its chosen state; `label` is its name for assistive tech.
   */
  readonly info?: { readonly open: boolean; readonly label: string };
}

/** A sort selector: the options, already translated, and the one in force. */
export interface FilterSort {
  readonly label: string;
  readonly value: string;
  readonly options: readonly { readonly value: string; readonly label: string }[];
}

/**
 * What a filter bar shows: chips, an optional sort selector and an optional button that opens a filter sheet, in one
 * wrapping row (or a packed one, see `rows`).
 */
export interface FilterBarModel {
  readonly chips: readonly FilterChip[];
  readonly sort?: FilterSort;
  /** The filter sheet button word ("Filters · 2"); the bar raises `mc-filter-sheet` on its tap. */
  readonly sheetLabel?: string;
  /** Put before a chip id in its `data-key` and in the key `mc-activate` reports ("chip:"). */
  readonly prefix?: string;
  /** The most rows shown; what does not fit is cut off, not spilled (0, the default, wraps without a limit). */
  readonly rows?: number;
  /** A row height in px (0, the default, lets a chip be as tall as its own minimum of 44). */
  readonly rowHeight?: number;
  /** The space between chips and rows in px (8). */
  readonly gap?: number;
  /** One row that scrolls sideways instead of wrapping (a phone's chip strip). */
  readonly rail?: boolean;
}
