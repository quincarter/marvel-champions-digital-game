import type { McButtonKind } from "../../shared/button.types.js";
import type { PictureSource } from "../../shared/picture.types.js";
import type { TextLine } from "../../shared/text-line.types.js";

/** The control at the end of a list row ("Pick"): `disabled` dims it but a tap still raises `mc-activate`, so the screen can say why. */
export interface DeckGridPick {
  readonly label: string;
  readonly look: McButtonKind;
  /** Unavailable: the reason (a tooltip), or true with none to give. */
  readonly disabled?: string | true;
}

/** One deck: a tile in the grid or a row in the list. */
export interface DeckGridItem {
  readonly id: string;
  /** The hero's identity card, which the hover popover shows from the picture. */
  readonly cardId: string;
  readonly picture: PictureSource;
  readonly lines: readonly TextLine[];
  /** The aspect colours as a stripe across a tile's picture (CSS colours). */
  readonly stripe: readonly string[];
  /** Selected, or in the seat now: the heavier frame. */
  readonly heavy: boolean;
  /** A list row's trailing control (a tile has none). */
  readonly pick?: DeckGridPick;
}

export interface DeckGridModel {
  readonly mode: "grid" | "list";
  readonly columns: number;
  readonly gap: number;
  /** A tile's picture height in px. */
  readonly artHeight: number;
  /** The width the tiles or rows take, px; the scrollbar's gutter comes out of the frame beside it. */
  readonly contentWidth: number;
  readonly items: readonly DeckGridItem[];
  /** Words in place of the decks (none match, none yet), or null. */
  readonly emptyText: string | null;
  /** The words are "loading": fainter. */
  readonly loading: boolean;
}
