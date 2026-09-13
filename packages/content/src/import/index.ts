/**
 * Turning untrusted decklist data — MarvelCDB's public deck JSON, or text a
 * player pasted — into `DeckContents`. Pure and network-free: every function
 * here takes the card pool as data, never fetches it.
 *
 * Deliberately separate from legality (`validateDeck`) and playability
 * (`unscriptedCards`), both in `@mc/engine`: this module only resolves what a
 * decklist *names*. See `types.ts` for why, and `from-marvelcdb-json.ts` /
 * `from-text.ts` for the two formats.
 */
export * from "./types.js";
export * from "./pool-index.js";
export * from "./from-marvelcdb-json.js";
export * from "./from-text.js";
export * from "./url.js";
