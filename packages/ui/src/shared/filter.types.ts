/** One toggle chip in a filter bar: a word, an optional count, and whether it is on. */
export interface FilterChipModel {
  /** What `mc-filter` reports when the chip is tapped. */
  readonly key: string;
  readonly label: string;
  /** A count shown after the label (the games under a tab); left out for none. */
  readonly count?: number;
  readonly selected: boolean;
  readonly disabled?: boolean;
}

/** A sort selector: the options, already translated, and the one in force. */
export interface FilterSort {
  readonly label: string;
  readonly value: string;
  readonly options: readonly { readonly value: string; readonly label: string }[];
}

/** What a filter bar shows: chips, an optional sort selector and an optional button that opens a filter sheet. */
export interface FilterBarModel {
  readonly chips: readonly FilterChipModel[];
  readonly sort?: FilterSort;
  /** The sheet button's word ("Filters · 2"); the bar raises `mc-filter-sheet` on its tap. */
  readonly sheetLabel?: string;
}
