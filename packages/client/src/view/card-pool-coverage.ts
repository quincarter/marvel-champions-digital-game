/**
 * The Title menu footer's "N / M cards live" (docs/phase4-screen-gaps.md §3 W2, D01): how much of the whole game a
 * player can actually play here.
 *
 * - M is every card in the game, from the MarvelCDB catalog (`@mc/content`'s `CATALOG_CARD_COUNT`), not just the
 *   packs this app has ingested — so the number reads as progress toward the full card pool.
 * - N is how many of those printed cards are in the app's playable pool with every ability they reference scripted
 *   (`@mc/engine`'s `abilityRefsOf` against the `AbilityRegistry`, the same predicate `unscriptedCards` checks per
 *   deck in `view/deck-list-model.ts`). A card with no ability at all needs no script, so it's live as soon as it's
 *   in the pool.
 *
 * Both sides count printed cards (`printedCodesOfCard`): the app folds a villain's stages into one card and MarvelCDB
 * lists them apart, so counting app cards would compare different units.
 */
import { CATALOG_CARD_COUNT, CATALOG_REPRINTS, printedCodesOfCard, type AnyCard } from "@mc/content";
import { abilityRefsOf, type EngineDeps } from "@mc/engine";

export interface CardPoolCoverage {
  /** Printed cards in the playable pool with every referenced ability scripted. */
  readonly liveCards: number;
  /** Every printed card in the game. */
  readonly totalCards: number;
}

export function cardPoolCoverageOf(
  cards: readonly AnyCard[],
  deps: EngineDeps,
  totalCards: number = CATALOG_CARD_COUNT,
): CardPoolCoverage {
  const live = new Set<string>();
  for (const card of cards) {
    if (!abilityRefsOf(card).every((ref) => deps.abilities[ref.id] !== undefined)) continue;
    for (const code of printedCodesOfCard(card, CATALOG_REPRINTS)) live.add(code);
  }
  return { liveCards: live.size, totalCards };
}

/** "1,065 / 3,678 cards live" — the footer's own wording, so every caller says it the same way. */
export function cardPoolCoverageText(coverage: CardPoolCoverage): string {
  const count = (n: number): string => n.toLocaleString("en-US");
  return `${count(coverage.liveCards)} / ${count(coverage.totalCards)} cards live`;
}
