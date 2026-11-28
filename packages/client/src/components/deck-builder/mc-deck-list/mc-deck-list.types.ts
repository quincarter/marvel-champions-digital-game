import type { DeckLineModel } from "../mc-deck-line/mc-deck-line.types.js";

/** A group of the list ("Allies · 6"). */
export interface DeckListGroupModel {
  readonly label: string;
  readonly lines: readonly DeckLineModel[];
}

/** "Your deck": a Sort button, a Review button (unless the pinned bar carries it) and the lines, by group. */
export interface DeckListModel {
  readonly label: string;
  readonly sortLabel: string;
  /** Review's words; null when it rides in the pinned bar beside Save (a phone's Deck tab). */
  readonly reviewLabel: string | null;
  readonly reviewDisabled: boolean;
  readonly groups: readonly DeckListGroupModel[];
}
