import type { CardCellModel, CardFaceTileModel } from "@mc/ui";

/** The identity's faces, or one multi-faced card's: a titled row of scans. */
export interface DeckFaceGroupModel {
  readonly title: string;
  readonly tiles: readonly CardFaceTileModel[];
}

/** One group of the deck's cards (by signature set or aspect): a titled grid of cells. */
export interface DeckCardGroupModel {
  readonly title: string;
  readonly cells: readonly CardCellModel[];
}

export interface McDeckCardSectionsProps {
  faces: readonly DeckFaceGroupModel[];
  groups: readonly DeckCardGroupModel[];
  /** Said under the faces when no card matches the filter; empty for none. */
  note: string;
  /** The player's card size setting, as a factor (1 = normal). */
  cardScale: number;
  /** A desktop-sized screen: its captions are a step larger. */
  desktop: boolean;
}
