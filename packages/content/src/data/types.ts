import type { CardId } from "../schema/index.js";

/**
 * Where a normalized card record came from. Not game data — an audit trail so
 * any value can be traced back to the source record(s) and to every hand
 * correction applied on top of them (see packages/content/scripts/marvelcdb/curation/).
 */
export interface CardProvenance {
  readonly cardId: CardId;
  /** MarvelCDB `card_set_code` of the source record(s) (hero kit, encounter set, aspect). */
  readonly cardSetCode: string;
  /** Every MarvelCDB record code folded into this card (faces, villain stages, scheme A/B sides, variants). */
  readonly marvelcdbCodes: readonly string[];
  /** Human-readable list of corrections/errata/data decisions applied during ingestion. */
  readonly corrections: readonly string[];
  /**
   * The id of the card this one is a verbatim reprint of (MarvelCDB `duplicate_of_code` on the source record —
   * e.g. The Rise of Red Skull's Avengers Tower, `04021`, names Captain America's `03024`). Ingestion still
   * emits the reprint as its own card (matching the wave 1 reprint-art policy — its own id, its art borrowed from
   * the original); this is only the pointer a MarvelCDB decklist importer (Phase 9) needs to treat either code as
   * the same card for deckbuilding limits. Absent for a card that is not a reprint, or whose reprint relationship
   * MarvelCDB doesn't record this way.
   */
  readonly duplicateOfCardId?: CardId;
}

/** A MarvelCDB record that was intentionally not turned into a card, and why. */
export interface DroppedSourceRecord {
  readonly marvelcdbCode: string;
  readonly reason: string;
}
