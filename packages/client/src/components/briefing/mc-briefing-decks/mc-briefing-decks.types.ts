import type { DeckRowModel } from "../mc-briefing-deck-row/mc-briefing-deck-row.types.js";

/** The Decks panel: one row per seat and the line under them, or (`waiting`) the line an unfilled panel says. */
export interface DecksModel {
  readonly rows: readonly DeckRowModel[];
  /** The line under the rows, already translated. */
  readonly note: string;
  readonly waiting: string | null;
}
