import type { McPictureCardModel } from "@mc/ui";

/** The picture's shape: stories, rulebooks and artwork are landscape panels, heroes and villains portraits, promo cards whole cards. */
export type ExtrasShelfShape = "landscape" | "portrait" | "card";

/** One tile of the shelf. */
export interface ExtrasTile {
  /** The entry's id: the tile's stop is `tile:<id>`. */
  readonly id: string;
  /** The picture card's words, chip and picture. */
  readonly card: McPictureCardModel;
  /** A promo tile: the card the mouse over it shows in the hover popover. */
  readonly cardId?: string;
  /** A promo tile: which promo set it is (the hover shows that set's own picture). */
  readonly promoSetId?: string;
}

export interface McExtrasShelfProps {
  tiles: readonly ExtrasTile[];
  shape: ExtrasShelfShape;
  /** What it says with no tiles. */
  empty: string;
}
