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
}

/** A MarvelCDB record that was intentionally not turned into a card, and why. */
export interface DroppedSourceRecord {
  readonly marvelcdbCode: string;
  readonly reason: string;
}
