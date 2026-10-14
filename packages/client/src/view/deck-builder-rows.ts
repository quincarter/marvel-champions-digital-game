/**
 * Row sizes of the deck builder's two one-column lists (the identity picker and the card pool / deck list), scaled by
 * the global Card size factor (`settings.ts`'s `cardSizeFactor`: 1, 1.25 or 1.5). The lists stay one column; a bigger
 * setting makes the rows taller and the card picture bigger in them, and the lists scroll.
 */

/** Tall enough for the hero's art to read beside the name, at Standard. */
const IDENTITY_ROW_HEIGHT = 64;
/** Tall enough for the card's own picture and a few lines of what it does, at Standard. */
const CARD_ROW_HEIGHT = 104;
/** A row's top and bottom padding inside its box (`#renderCardRow` draws the row 6 short of the slot, thumb inset 6). */
const THUMB_VERTICAL_INSET = 18;

export interface DeckBuilderRowSizes {
  /** The slot height of one card row (the drawn row is 6 shorter, the gap between rows). */
  readonly cardRowHeight: number;
  /** The card picture's width in a pool row, at the printed card's own proportions (63 × 88 mm). */
  readonly cardThumbWidth: number;
  /** The identity row's own height (its slot is 6 taller). */
  readonly identityRowHeight: number;
}

export function deckBuilderRowSizes(cardScale = 1): DeckBuilderRowSizes {
  const scale = cardScale > 0 ? cardScale : 1;
  const cardRowHeight = Math.round(CARD_ROW_HEIGHT * scale);
  return {
    cardRowHeight,
    cardThumbWidth: Math.round((cardRowHeight - THUMB_VERTICAL_INSET) * (63 / 88)),
    identityRowHeight: Math.round(IDENTITY_ROW_HEIGHT * scale),
  };
}
