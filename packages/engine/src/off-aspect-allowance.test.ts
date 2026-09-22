/**
 * docs/phase7-wave3.md §1.5: `IdentityDeckbuilding.offAspectAllowance`. Gamora (`gam` 18001b), Skilled Tactician: "You may
 * include up to 6 attack and/or thwart events in your deck from aspects other than your chosen aspect." Spider-Man and
 * Core's Aggression events stand in for Gamora and her pool.
 *
 * Sources: RRG 1.8 Appendix I "Deck Customization" (p. 50): "Any 'deckbuilding requirements' on the player's identity
 * card must be followed."
 */

import {
  CORE_CARDS,
  CORE_STARTER_DECKS,
  trait,
  type AnyCard,
  type DeckContents,
  type IdentityDeckbuilding,
  type PlayerCard,
} from "@mc/content";
import { describe, expect, it } from "vitest";
import { validateDeck, type DeckProblem } from "./deck.js";

const SPIDER_MAN = "01001a";
const ATTACK = trait("Attack");
const THWART = trait("Thwart");

const starter = (): DeckContents => {
  const deck = CORE_STARTER_DECKS.find((d) => d.id === "core-spider-man-justice");
  if (!deck) throw new Error("no Spider-Man starter deck");
  return { identityCardId: deck.identityCardId, aspects: deck.aspects, cards: deck.cards };
};
const isPlayer = (card: AnyCard): card is PlayerCard => "deckLimit" in card;
/** Core Aggression events printed with the Attack trait: off-aspect for a Justice deck. */
const aggressionAttacks = CORE_CARDS.filter(
  (card): card is PlayerCard =>
    isPlayer(card) && card.type === "event" && card.aspect === "aggression" && card.traits.includes(ATTACK),
);
const withCards = (
  deck: DeckContents,
  adds: readonly { cardId: PlayerCard["id"]; quantity: number }[],
): DeckContents => ({
  ...deck,
  cards: [...deck.cards, ...adds],
});
const spiderManWith = (deckbuilding: IdentityDeckbuilding): readonly AnyCard[] =>
  CORE_CARDS.map((card) =>
    card.id === SPIDER_MAN && card.type === "hero_identity" ? { ...card, deckbuilding } : card,
  );
const problemsOf = (deck: DeckContents, pool: readonly AnyCard[] = CORE_CARDS): readonly DeckProblem[] => {
  const verdict = validateDeck(deck, pool);
  return verdict.ok ? [] : verdict.problems;
};
const TACTICIAN = (maxCards: number): IdentityDeckbuilding => ({
  offAspectAllowance: { cardType: "event", anyTrait: [ATTACK, THWART], maxCards },
});

describe("§1.5 'up to 6 attack and/or thwart events from other aspects'", () => {
  const [first, second] = aggressionAttacks;
  if (!first || !second) throw new Error("Core has fewer than two Aggression attack events");
  const deck = withCards(starter(), [
    { cardId: first.id, quantity: 2 },
    { cardId: second.id, quantity: 2 },
  ]);

  it("without the requirement, off-aspect attack events are refused", () => {
    expect(problemsOf(deck).some((p) => p.code === "aspect_restriction")).toBe(true);
  });

  it("with it, up to the maximum is legal, across titles", () => {
    expect(problemsOf(deck, spiderManWith(TACTICIAN(6)))).toEqual([]);
    expect(problemsOf(starter(), spiderManWith(TACTICIAN(6)))).toEqual([]);
  });

  it("more than the maximum is a deckbuilding problem naming the cards", () => {
    const problems = problemsOf(deck, spiderManWith(TACTICIAN(3)));
    const found = problems.find((p) => p.code === "deckbuilding_requirement");
    expect(found?.message).toContain("up to 3");
    expect(found?.cardIds).toEqual([first.id, second.id]);
  });

  it("an off-aspect card that is not an attack or thwart event is still refused", () => {
    const support = CORE_CARDS.find(
      (card): card is PlayerCard => isPlayer(card) && card.type === "support" && card.aspect === "aggression",
    );
    if (!support) throw new Error("no Core Aggression support");
    const problems = problemsOf(
      withCards(starter(), [{ cardId: support.id, quantity: 1 }]),
      spiderManWith(TACTICIAN(6)),
    );
    expect(problems.some((p) => p.code === "aspect_restriction")).toBe(true);
  });
});
