/**
 * Shared shapes for turning untrusted decklist data (a MarvelCDB API response,
 * or text a player pasted) into a `DeckContents`.
 *
 * This module answers one question — "what does this data name?" — and
 * deliberately does not answer "is this a legal deck?" (`validateDeck` in
 * `@mc/engine`) or "can this build play it?" (`unscriptedCards`). Those stay
 * rules questions, answered after import succeeds, by the engine.
 *
 * What import *does* own: a decklist is untrusted data, not instructions. A
 * malformed shape, a quantity that isn't a small positive integer, a card
 * code/name that doesn't resolve, an identity that isn't a hero identity, or
 * an absent aspect are all reported here, specifically and all at once —
 * never silently dropped into a half-built deck.
 */
import type { CardId } from "../schema/ids.js";
import type { DeckContents } from "../schema/decks.js";

export type ImportProblemCode =
  /** The input isn't recognizable as the format being parsed at all (bad JSON, no card lines found, wrong shape). */
  | "invalid_input"
  /** The input is too large to be a real decklist; refused before it is walked. */
  | "oversized_input"
  /** No identity could be determined at all. */
  | "missing_identity"
  /** A named/coded identity is not in the given pool. */
  | "unknown_identity"
  /** The identity resolves to a real card, but it isn't a hero identity. */
  | "not_an_identity"
  /** A card code or name in the decklist does not resolve to any card in the given pool. */
  | "unknown_card"
  /** A card name matches more than one card code and the importer cannot safely tell which quantities go where. */
  | "ambiguous_card_name"
  /** A listed quantity is not a small positive whole number. */
  | "invalid_quantity"
  /** The decklist records no aspect at all. */
  | "missing_aspect"
  /** The same card was listed on two lines; total, don't overwrite. */
  | "duplicate_line";

export interface ImportProblem {
  readonly code: ImportProblemCode;
  /** Player-readable, meant to be shown verbatim. */
  readonly message: string;
  readonly cardIds?: readonly CardId[];
}

export type ImportResult =
  | { readonly ok: true; readonly contents: DeckContents; readonly heroName: string | null }
  | { readonly ok: false; readonly problems: readonly ImportProblem[] };

/** A hard ceiling on input size, checked before any parsing: real decklists are a few KB. */
export const MAX_IMPORT_TEXT_LENGTH = 20_000;
/** A hard ceiling on distinct decklist lines/slots. Core's largest legal deck has well under 40 distinct titles. */
export const MAX_IMPORT_LINES = 300;
/** A hard ceiling on one line's quantity. No legal deck needs more copies of one card than its full size. */
export const MAX_LINE_QUANTITY = 50;
