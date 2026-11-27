/** One toggle chip of a filter bar. */
export interface McFilterChipModel {
  /** The chip id: a press raises `mc-activate` with the key `chip:<id>`. */
  readonly id: string;
  /** The chip word, already translated. */
  readonly label: string;
  /** How many items it would show (a count printed after the word), when known. */
  readonly count?: number;
  /** On: ink fill, paper word and a leading check mark (never color alone). */
  readonly selected: boolean;
  readonly disabled?: boolean;
  /** A stamp color (an aspect chip): the fill and the word ink, as CSS colors. */
  readonly tint?: { readonly fill: string; readonly ink: string };
}

/** A sort selector: one chip that steps through its options. */
export interface McFilterSortModel {
  /** What it sorts by now, already translated ("Sort: Cost"). */
  readonly label: string;
  /** The option a press moves to (the key is `sort`, `detail.id` is this). */
  readonly nextId: string;
}

/** A filter bar: the Filters button (when chips fold away), the chips, and a sort selector. */
export interface McFilterBarModel {
  readonly chips: readonly McFilterChipModel[];
  /** A Filters button that folds the chips away until pressed (`open`); `active` counts the chips that are on. */
  readonly filters?: { readonly label: string; readonly open: boolean; readonly active?: number };
  readonly sort?: McFilterSortModel;
  /** Where each row of chips packs: from the start (the deck list) or the end (the pool header). */
  readonly align?: "start" | "end";
}
