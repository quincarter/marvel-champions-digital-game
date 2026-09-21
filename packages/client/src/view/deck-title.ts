/**
 * A deck's own display text — the short "HERO / ASPECT" title and the
 * one-line meta caption underneath it — factored out of Decks & Collection
 * (`scenes/decks.ts`'s own former `cardTitleOf`/`deckMetaLine`) so Deck
 * check's header (`scenes/deck-check.ts`, rebuilt 2026-09-18 for the owner's
 * "doesn't flow well with the design" note) reads a deck with the *identical*
 * words Decks & Collection already uses, rather than inventing its own
 * phrasing for "which deck is this and is it legal" a second time.
 */
import type { Deck } from "@mc/content";
import type { CardPool } from "@mc/engine";
import { deckStatsOf } from "./deck-stats.js";
import { deckStatusOf } from "./deck-status.js";
import type { DeckOption } from "./deck-list-model.js";
import type { DeckSourceKind } from "./roster-filter.js";

export const SOURCE_LABEL: Readonly<Record<DeckSourceKind, string>> = {
  precon: "Precon",
  imported: "Imported",
  userBuilt: "Built",
};

/** A capitalized aspect/basic name for a short deck title ("justice" → "Justice"). */
export function titleCase(word: string): string {
  return word.length === 0 ? word : word.charAt(0).toUpperCase() + word.slice(1);
}

/**
 * A deck's own title: a precon's is the short "HERO / ASPECT" form (its long
 * printed name, e.g. "Spider-Man (Justice) — Core Set Starter Deck", moves
 * into the meta line instead — `deckMetaLine` below); a saved/imported deck's
 * title is simply its own name, already short because a player chose it
 * themselves.
 */
export function cardTitleOf(option: DeckOption): string {
  if (option.deck.source.kind !== "precon") return option.deck.name;
  const identity = option.identityName ?? "Unknown";
  const aspects = option.deck.aspects.map(titleCase).join(" + ");
  return aspects ? `${identity} / ${aspects}` : identity;
}

/**
 * The deck's meta line: identity, card count and status for a saved/imported
 * deck; the long printed name, card count and status for a precon (whose
 * title above already dropped that long name). `pool` is whatever real card
 * pool the caller already has (`POOL_CARDS` today) — the same explicit-pool
 * convention `deckStatsOf` itself uses, rather than reaching for a module-level
 * constant, so this stays testable against any pool.
 */
export function deckMetaLine(option: DeckOption, pool: CardPool): string {
  const stats = deckStatsOf(option.deck, pool);
  const status = deckStatusOf(option).text.toLowerCase();
  const deck: Deck = option.deck;
  if (deck.source.kind === "precon") {
    // The title already says hero and aspect; keep only what the printed name adds ("Core Set Starter Deck"),
    // so the count and legality always fit on the one line this reads on.
    const product = deck.name.includes("—") ? deck.name.slice(deck.name.indexOf("—") + 1).trim() : deck.name;
    return `${product} · ${stats.totalCards} cards · ${status}`;
  }
  return `${option.identityName ?? "unknown identity"} · ${stats.totalCards} cards · ${status} · ${SOURCE_LABEL[deck.source.kind].toLowerCase()}`;
}
