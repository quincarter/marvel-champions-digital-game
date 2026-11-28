import type { FilterChip } from "@mc/ui";
import type { ModStoreSize } from "../shared/mod-store-size.types.js";

export interface ModFindersSearch {
  readonly value: string;
  readonly placeholder: string;
  readonly clearLabel: string;
}

export interface McModFindersProps {
  size: ModStoreSize;
  search: ModFindersSearch;
  /** The sort button's words ("⇅ A to Z"). */
  sortLabel: string;
  /** The creator picked on Credits (`creator`), then the tab's tags (`tag:<name>`): their words, counts and states. */
  chips: readonly FilterChip[];
  /** Clear's words while something narrows the list; empty for no Clear. */
  clearLabel: string;
  /** "3 of 12 packs". */
  countText: string;
}
