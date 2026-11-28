import type { StatTile } from "@mc/ui";
import type { DeckCardRowModel } from "../mc-deck-card-row/mc-deck-card-row.types.js";

export interface McDeckSummaryProps {
  /** A few boxed counts (Resources 12, Allies 6, Events 9). */
  tiles: readonly StatTile[];
  /** The deck's lines, in list order. */
  rows: readonly DeckCardRowModel[];
}
