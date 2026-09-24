/**
 * docs/phase7-wave4.md §1.4: `IdentityDeckbuilding.maxCopiesPerTitle`. Adam Warlock (`mts` 21031b), Avatar of Life: "You
 * cannot include more than 1 copy of any non-Adam Warlock card." Core's Spider-Man precon stands in for his deck: it
 * holds several aspect and basic titles at two or three copies, and identity-set titles at their printed counts.
 *
 * Sources: RRG 1.8 Appendix I "Deck Customization" (p. 50): "Any 'deckbuilding requirements' on the player's identity
 * card must be followed"; MC21 p. 3: "he cannot include more than one copy of any aspect card in his deck".
 */

import { CORE_CARDS, CORE_STARTER_DECKS, type AnyCard, type DeckContents } from "@mc/content";
import { describe, expect, it } from "vitest";
import { validateDeck, type DeckProblem } from "./deck.js";

const SPIDER_MAN = "01001a";

const starter = (): DeckContents => {
  const deck = CORE_STARTER_DECKS.find((d) => d.id === "core-spider-man-justice");
  if (!deck) throw new Error("no Spider-Man starter deck");
  return { identityCardId: deck.identityCardId, aspects: deck.aspects, cards: deck.cards };
};
const pool = (maxCopiesPerTitle?: number): readonly AnyCard[] =>
  CORE_CARDS.map((card) =>
    card.id === SPIDER_MAN && card.type === "hero_identity"
      ? { ...card, deckbuilding: maxCopiesPerTitle === undefined ? {} : { maxCopiesPerTitle } }
      : card,
  );
const problemsOf = (deck: DeckContents, cards: readonly AnyCard[]): readonly DeckProblem[] => {
  const verdict = validateDeck(deck, cards);
  return verdict.ok ? [] : verdict.problems;
};
const byId = new Map(CORE_CARDS.map((card) => [card.id as string, card]));
const identitySetCard = (id: string): boolean => {
  const card = byId.get(id);
  return card !== undefined && "aspect" in card && card.aspect === `hero:${SPIDER_MAN}`;
};

describe("§1.4 'no more than 1 copy of any non-identity card'", () => {
  const deck = starter();
  const multiples = deck.cards.filter((line) => line.quantity > 1 && !identitySetCard(line.cardId));
  const identityMultiples = deck.cards.filter((line) => line.quantity > 1 && identitySetCard(line.cardId));

  it("the precon is legal without the requirement, and has repeated titles on both sides of the identity set", () => {
    expect(problemsOf(deck, pool())).toEqual([]);
    expect(multiples.length).toBeGreaterThan(0);
    expect(identityMultiples.length).toBeGreaterThan(0);
  });

  it("with it, every repeated title outside the identity set is a copy-limit problem naming the rule", () => {
    const copyProblems = problemsOf(deck, pool(1)).filter((p) => p.code === "copy_limit");
    const flagged = new Set(copyProblems.flatMap((p) => p.cardIds));
    for (const line of multiples) expect(flagged.has(line.cardId)).toBe(true);
    for (const line of identityMultiples) expect(flagged.has(line.cardId)).toBe(false);
    expect(copyProblems[0]?.message).toContain("deckbuilding allows no more than 1 copy");
  });

  it("one copy of each is within it", () => {
    const singles: DeckContents = {
      ...deck,
      cards: deck.cards.map((line) => (identitySetCard(line.cardId) ? line : { ...line, quantity: 1 })),
    };
    expect(problemsOf(singles, pool(1)).filter((p) => p.code === "copy_limit")).toEqual([]);
  });
});
