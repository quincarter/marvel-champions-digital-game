/**
 * Replacements for a card that cannot be played at this table (`name-conflicts.ts`): the cards the deck could hold
 * instead, best first. Pure; the screens only draw it.
 *
 * Legality is never decided here. The pool is what the deck builder offers for this identity and aspects
 * (`browsablePool`), narrowed to the cards that keep the deck legal under the engine's `validateDeck` (aspect, deck
 * limits, unique rules, with every copy of the old card replaced), that do not themselves match a seated hero
 * (`cardsMatch` with the table rule), and that the player's packs include (`isUnlocked`).
 *
 * Ranking: allies of the same aspect as the old card first (basic for a basic card), then the other legal allies,
 * then every other legal card; within a tier the nearest cost first, then by name. The first row is the recommended
 * default.
 */
import type { AnyCard, CardId, Deck, HeroIdentityCard } from "@mc/content";
import { cardsMatch, entersPlayWhenPlayed, validateDeck, type TableRules } from "@mc/engine";
import { browsablePool } from "./deck-builder-model.js";
import { applyDeckSwaps } from "./name-conflicts.js";

export interface ReplacementCandidate {
  readonly card: AnyCard;
  /** 0 = same-aspect ally, 1 = other ally, 2 = any other card. */
  readonly tier: 0 | 1 | 2;
}

export interface ReplacementInput {
  readonly deck: Deck;
  /** The card being replaced (its id in `deck`). */
  readonly fromCardId: string;
  /** Every hero identity at the table (own seat included): a replacement may not match any but the deck's own. */
  readonly seatedHeroes: readonly HeroIdentityCard[];
  /** The deck's own hero. */
  readonly identity: HeroIdentityCard;
  readonly pool: readonly AnyCard[];
  readonly tableRules?: TableRules;
  /** The player's packs: false hides a card from the packs they have not unlocked. Default: all. */
  readonly isUnlocked?: (card: AnyCard) => boolean;
  /** False hides a card the build cannot play yet. Default: all. */
  readonly isPlayable?: (card: AnyCard) => boolean;
}

const costOf = (card: AnyCard): number => ("cost" in card && typeof card.cost === "number" ? card.cost : 0);
const aspectOf = (card: AnyCard): string => ("aspect" in card ? String((card as { aspect: string }).aspect) : "");

/** The legal replacements for one card, best first. */
export function replacementCandidatesOf(input: ReplacementInput): readonly ReplacementCandidate[] {
  const { deck, fromCardId, seatedHeroes, identity, pool } = input;
  const from = pool.find((card) => (card.id as string) === fromCardId);
  const copies = deck.cards.filter((e) => (e.cardId as string) === fromCardId).reduce((n, e) => n + e.quantity, 0);
  if (!from || copies === 0) return [];
  const others = seatedHeroes.filter((hero) => hero.id !== identity.id);
  const result: ReplacementCandidate[] = [];
  for (const card of browsablePool(pool, identity, deck.aspects)) {
    if (card.name === from.name || (card.id as string) === fromCardId) continue;
    if (input.isUnlocked && !input.isUnlocked(card)) continue;
    if (input.isPlayable && !input.isPlayable(card)) continue;
    if (entersPlayWhenPlayed(card) && others.some((hero) => cardsMatch(card, hero, input.tableRules))) continue;
    const swapped = applyDeckSwaps(deck, [{ deckId: deck.id as string, from: fromCardId, to: card.id as string }]);
    if (!validateDeck(swapped, pool).ok) continue;
    const tier = card.type === "ally" ? (aspectOf(card) === aspectOf(from) ? 0 : 1) : 2;
    result.push({ card, tier });
  }
  const target = costOf(from);
  return result.sort(
    (a, b) =>
      a.tier - b.tier ||
      (a.tier === 2 ? Number(aspectOf(b.card) === aspectOf(from)) - Number(aspectOf(a.card) === aspectOf(from)) : 0) ||
      Math.abs(costOf(a.card) - target) - Math.abs(costOf(b.card) - target) ||
      a.card.name.localeCompare(b.card.name),
  );
}

/** The id of the card a replacement picker preselects, or null when nothing can replace it. */
export function recommendedReplacementOf(candidates: readonly ReplacementCandidate[]): CardId | null {
  return candidates[0]?.card.id ?? null;
}
