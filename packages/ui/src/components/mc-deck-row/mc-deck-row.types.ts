import type { PictureSource } from "../../shared/picture.types.js";

/** An aspect stamp on a deck: the aspect's name on its printed frame colour (CSS colours). */
export interface DeckRowStamp {
  readonly label: string;
  readonly fill: string;
  readonly ink: string;
}

/** What a deck's verdict is: a leading mark says which, so it is never colour alone. */
export type DeckRowStatus = "ok" | "warning" | "blocked" | "locked";

/** One deck, as a row. Every word arrives translated. */
export interface McDeckRowModel {
  readonly deckId: string;
  readonly name: string;
  /** "Precon · 40 cards", "Tested · by X · MarvelCDB". */
  readonly source: string;
  readonly stamps: readonly DeckRowStamp[];
  /** "✓ Legal", or the verdict's problem. A leading ✓, ! or ✕ is kept; otherwise the status's mark is put in front. */
  readonly verdict: string;
  readonly legal: boolean;
  readonly picture: PictureSource | null;
  /** The action button's word ("Seat"). */
  readonly seatLabel: string;
  /** Why the action cannot be used now, or null. The button is dimmed with this as its tooltip and does nothing. */
  readonly disabled: string | null;
  /** The verdict's kind; left out, `ok` when `legal`, else `blocked`. */
  readonly status?: DeckRowStatus;
  /** The mark in front of the verdict, already translated ("Locked ·" for `locked`); left out, the status's own. */
  readonly mark?: string;
  /** The card the picture stands for: a hover popover and Inspect on the picture. Left out, none. */
  readonly cardId?: string | null;
}

/** `mc-deck-pick`: the row's action button was pressed (and was not disabled). */
export interface DeckPickDetail {
  readonly deckId: string;
}
