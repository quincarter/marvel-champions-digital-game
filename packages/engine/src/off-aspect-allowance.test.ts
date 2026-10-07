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
  CYCLOPS_STARTER_DECKS,
  WAVE6_CARDS,
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

/**
 * Scott Summers (`cyclops` 33001b): "You may include X-Men allies from any aspect in your deck." An allowance with no
 * `maxCards` is unlimited. Read from the emitted Cyclops identity, with X-Men allies from other hero packs.
 */
describe("§1.5 an allowance without a maximum (Cyclops, X-Men allies from any aspect)", () => {
  const cyclops = (): DeckContents => {
    const deck = CYCLOPS_STARTER_DECKS.find((d) => d.id === "cyclops-leadership");
    if (!deck) throw new Error("no Cyclops starter deck");
    return { identityCardId: deck.identityCardId, aspects: deck.aspects, cards: deck.cards };
  };
  const byId = new Map(WAVE6_CARDS.map((card) => [card.id as string, card]));
  const card = (id: string): PlayerCard => {
    const found = byId.get(id);
    if (!found || !isPlayer(found)) throw new Error(`no player card ${id}`);
    return found;
  };
  // Banshee, Marvel Girl (Justice); Iceman, Karma, Armor (Protection); Psylocke, Sunfire (Aggression).
  const xMenAllies = ["34014", "34015", "38010", "38011", "38012", "35013", "35014"].map(card);

  it("the precon's three off-aspect X-Men allies are legal", () => {
    expect(problemsOf(cyclops(), WAVE6_CARDS)).toEqual([]);
  });

  it("any number of X-Men allies from other aspects is legal", () => {
    for (const ally of xMenAllies) {
      expect(ally.type).toBe("ally");
      expect(ally.aspect).not.toBe("leadership");
      expect(ally.traits).toContain(trait("X-Men"));
    }
    const deck = withCards(
      cyclops(),
      xMenAllies.map((ally) => ({ cardId: ally.id, quantity: 1 })),
    );
    // 3 printed + 7 added = 10 off-aspect allies, past any Gamora-style cap.
    expect(deck.cards.reduce((n, line) => n + line.quantity, 0)).toBe(47);
    expect(problemsOf(deck, WAVE6_CARDS)).toEqual([]);
  });

  it("an off-aspect card that is not an X-Men ally is still refused, with its readable message", () => {
    const support = CORE_CARDS.find(
      (c): c is PlayerCard => isPlayer(c) && c.type === "support" && c.aspect === "aggression",
    );
    if (!support) throw new Error("no Core Aggression support");
    const problems = problemsOf(withCards(cyclops(), [{ cardId: support.id, quantity: 1 }]), [
      ...WAVE6_CARDS,
      ...CORE_CARDS,
    ]);
    expect(problems.map((p) => p.code)).toEqual(["aspect_restriction"]);
    expect(problems[0]?.cardIds).toEqual([support.id]);
    expect(problems[0]?.message).toBe(
      `${support.name} is a Aggression card, but this deck's aspect is Leadership; beyond its identity set a deck may only use its chosen aspect and basic cards.`,
    );
  });
});

/**
 * An allowance by card type alone, with no trait list (Cable, `next_evol` 40001b: "You may include player side schemes
 * from any aspect in your deck."). Synthetic: Core has no player side schemes, so a bare `support` allowance on Spider-Man
 * stands in, with Core Aggression cards as the off-aspect pool.
 */
describe("an allowance with no trait list (card type only)", () => {
  const aggression = (type: PlayerCard["type"]): PlayerCard => {
    const found = CORE_CARDS.find((c): c is PlayerCard => isPlayer(c) && c.type === type && c.aspect === "aggression");
    if (!found) throw new Error(`no Core Aggression ${type}`);
    return found;
  };
  const support = aggression("support");
  const event = aggression("event");
  const BY_TYPE: IdentityDeckbuilding = { offAspectAllowance: { cardType: "support" } };

  it("any off-aspect card of that type is legal, whatever its traits", () => {
    const deck = withCards(starter(), [{ cardId: support.id, quantity: 1 }]);
    expect(problemsOf(deck)).not.toEqual([]);
    expect(problemsOf(deck, spiderManWith(BY_TYPE))).toEqual([]);
  });

  it("an off-aspect card of another type is still refused", () => {
    const deck = withCards(starter(), [{ cardId: event.id, quantity: 1 }]);
    expect(problemsOf(deck, spiderManWith(BY_TYPE)).some((p) => p.code === "aspect_restriction")).toBe(true);
  });

  it("a maximum still applies, and its message does not name a trait", () => {
    const deck = withCards(starter(), [{ cardId: support.id, quantity: 2 }]);
    const found = problemsOf(deck, spiderManWith({ offAspectAllowance: { cardType: "support", maxCards: 1 } })).find(
      (p) => p.code === "deckbuilding_requirement",
    );
    expect(found?.message).toContain("up to 1 support cards from other aspects");
  });
});
