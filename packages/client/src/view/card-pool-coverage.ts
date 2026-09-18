/**
 * The Title menu footer's "N / M cards live" (docs/phase4-screen-gaps.md §3
 * W2, D01): how much of the app's own card pool has an ability script behind
 * every ability it references, straight from `@mc/engine`'s own
 * `abilityRefsOf`/`AbilityRegistry` — the same predicate `unscriptedCards`
 * checks per deck (`view/deck-list-model.ts`), just summed over the whole
 * pool rather than one deck. A card with no ability references at all needs
 * no script and isn't counted either way, mirroring `unscriptedCards`'s own
 * rule.
 */
import type { AnyCard } from "@mc/content";
import { abilityRefsOf, type EngineDeps } from "@mc/engine";

export interface CardPoolCoverage {
  /** How many of `totalCards` have every referenced ability scripted. */
  readonly scriptedCards: number;
  /** How many pool cards reference at least one ability (so need a script at all). */
  readonly totalCards: number;
}

export function cardPoolCoverageOf(cards: readonly AnyCard[], deps: EngineDeps): CardPoolCoverage {
  let scriptedCards = 0;
  let totalCards = 0;
  for (const card of cards) {
    const refs = abilityRefsOf(card);
    if (refs.length === 0) continue;
    totalCards += 1;
    if (refs.every((ref) => deps.abilities[ref.id] !== undefined)) scriptedCards += 1;
  }
  return { scriptedCards, totalCards };
}

/** "233 / 233 cards live" — the footer's own wording, so every caller says it the same way. */
export function cardPoolCoverageText(coverage: CardPoolCoverage): string {
  return `${coverage.scriptedCards} / ${coverage.totalCards} cards live`;
}
