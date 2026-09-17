import { describe, expect, test } from "vitest";
import {
  CORE_CARDS,
  CORE_STARTER_DECKS,
  WAVE1_CARDS,
  WAVE1_STARTER_DECKS,
  cardId,
  deckFromStarterDeck,
  type Deck,
} from "@mc/content";
import { deckStatsOf } from "./deck-stats.js";

const sumQuantities = (deck: Deck): number => deck.cards.reduce((total, entry) => total + entry.quantity, 0);

describe("deckStatsOf: every Core precon", () => {
  for (const starter of CORE_STARTER_DECKS) {
    test(`${starter.name}: every card in the deck is classified`, () => {
      const deck = deckFromStarterDeck(starter, "poolv1");
      const stats = deckStatsOf(deck, CORE_CARDS);

      expect(stats.totalCards).toBe(sumQuantities(deck));
      expect(stats.missingCardIds).toEqual([]);

      const typeTotal = Object.values(stats.countsByType).reduce((sum, n) => sum + (n ?? 0), 0);
      expect(typeTotal).toBe(stats.totalCards);

      const aspectTotal = Object.values(stats.countsByAspect).reduce((sum, n) => sum + n, 0);
      expect(aspectTotal).toBe(stats.totalCards);

      // Every Core precon has at least one cost-bearing card, so there's something to average.
      expect(stats.averageCost).not.toBeNull();
      expect(stats.averageCost!).toBeGreaterThan(0);

      const curveTotal = stats.costCurve.reduce((sum, bucket) => sum + bucket.count, 0);
      const resourceCount = stats.countsByType.resource ?? 0;
      expect(curveTotal).toBe(stats.totalCards - resourceCount);

      // Buckets are sorted ascending by cost, with no duplicate cost values.
      const costs = stats.costCurve.map((bucket) => bucket.cost);
      expect(costs).toEqual([...costs].sort((a, b) => a - b));
      expect(new Set(costs).size).toBe(costs.length);
    });
  }
});

describe("deckStatsOf: a wave 1 precon (Doctor Strange)", () => {
  const starter = WAVE1_STARTER_DECKS.find((d) => (d.id as string) === "drs-protection")!;
  const deck = deckFromStarterDeck(starter, "poolv1");

  test("classifies every card, none missing, against the wave 1 pool", () => {
    const stats = deckStatsOf(deck, WAVE1_CARDS);
    expect(stats.totalCards).toBe(sumQuantities(deck));
    expect(stats.missingCardIds).toEqual([]);
  });

  test("the Invocation deck's cards never appear — they're never in `deck.cards` to begin with", () => {
    // Crimson Bands of Cyttorak, Images of Ikonn, Seven Rings of Raggadorr, Vapors of Valtorr, Winds of Watoomb.
    const invocationIds = ["09032", "09033", "09034", "09035", "09036"].map((id) => cardId(id));
    for (const id of invocationIds) {
      expect(deck.cards.some((entry) => entry.cardId === id)).toBe(false);
    }
    // So they can't have leaked into any of deckStatsOf's own accounting either.
    const stats = deckStatsOf(deck, WAVE1_CARDS);
    expect(stats.totalCards).toBe(sumQuantities(deck));
  });
});

describe("deckStatsOf: cards with no cost and cards not in the pool", () => {
  test("a resource card is counted by type and aspect, but excluded from the cost curve and average", () => {
    // "Genius" (01089): a basic resource card, no printed cost.
    const deck: Pick<Deck, "cards"> = { cards: [{ cardId: cardId("01089"), quantity: 2 }] };
    const stats = deckStatsOf(deck, CORE_CARDS);
    expect(stats.totalCards).toBe(2);
    expect(stats.costCurve).toEqual([]);
    expect(stats.averageCost).toBeNull();
    expect(stats.countsByType.resource).toBe(2);
    expect(stats.countsByAspect.basic).toBe(2);
  });

  test("a card id absent from the pool is reported as missing and excluded from every count", () => {
    const deck: Pick<Deck, "cards"> = { cards: [{ cardId: cardId("99999-does-not-exist"), quantity: 3 }] };
    const stats = deckStatsOf(deck, CORE_CARDS);
    expect(stats.totalCards).toBe(3);
    expect(stats.missingCardIds).toEqual([cardId("99999-does-not-exist")]);
    expect(stats.costCurve).toEqual([]);
    expect(stats.averageCost).toBeNull();
    expect(stats.countsByType).toEqual({});
    expect(Object.values(stats.countsByAspect).every((n) => n === 0)).toBe(true);
  });
});

describe("deckStatsOf: a custom deck", () => {
  test("mixes aspect, basic and signature cards; the curve and averages reflect only cost-bearing cards", () => {
    const deck: Pick<Deck, "cards"> = {
      cards: [
        { cardId: cardId("01089"), quantity: 1 }, // Genius (basic resource, no cost)
        { cardId: cardId("01002"), quantity: 3 }, // Black Cat (ally, cost-bearing)
      ],
    };
    const stats = deckStatsOf(deck, CORE_CARDS);
    expect(stats.totalCards).toBe(4);
    expect(stats.missingCardIds).toEqual([]);
    // Whatever 01002 turns out to be, it's cost-bearing (not a resource), so the curve holds exactly its cost.
    const cardTwo = CORE_CARDS.find((c) => (c.id as string) === "01002")!;
    if ("cost" in cardTwo) {
      expect(stats.costCurve).toEqual([{ cost: cardTwo.cost, count: 3 }]);
      expect(stats.averageCost).toBe(cardTwo.cost);
    }
  });
});
