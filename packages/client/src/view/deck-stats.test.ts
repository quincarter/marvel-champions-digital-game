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
import { costCurveBars, deckListGroupsOf, deckStatsOf } from "./deck-stats.js";

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

describe("costCurveBars", () => {
  test("every Core precon: exactly capAt+1 bars, summing to the curve total, in ascending order 0..capAt-1 then the overflow bucket", () => {
    for (const starter of CORE_STARTER_DECKS) {
      const deck = deckFromStarterDeck(starter, "poolv1");
      const stats = deckStatsOf(deck, CORE_CARDS);
      const bars = costCurveBars(stats);
      expect(bars).toHaveLength(5);
      expect(bars.map((b) => b.label)).toEqual(["0", "1", "2", "3", "4+"]);
      const curveTotal = stats.costCurve.reduce((sum, bucket) => sum + bucket.count, 0);
      expect(bars.reduce((sum, bar) => sum + bar.count, 0)).toBe(curveTotal);
    }
  });

  test("a cost at or above capAt collapses into the overflow bucket", () => {
    const stats = deckStatsOf(
      { cards: [{ cardId: cardId("01002"), quantity: 1 }] },
      CORE_CARDS,
    );
    // Whatever 01002 costs, force the question by building the curve by hand instead.
    const fake = { ...stats, costCurve: [{ cost: 2, count: 3 }, { cost: 4, count: 1 }, { cost: 7, count: 2 }] };
    expect(costCurveBars(fake)).toEqual([
      { label: "0", count: 0 },
      { label: "1", count: 0 },
      { label: "2", count: 3 },
      { label: "3", count: 0 },
      { label: "4+", count: 3 },
    ]);
  });

  test("a deck with nothing at a given cost still gets a zero-height bar there (a fixed bar count, never fewer)", () => {
    const stats = deckStatsOf({ cards: [{ cardId: cardId("01089"), quantity: 2 }] }, CORE_CARDS); // Genius: no cost at all
    expect(costCurveBars(stats)).toEqual([
      { label: "0", count: 0 },
      { label: "1", count: 0 },
      { label: "2", count: 0 },
      { label: "3", count: 0 },
      { label: "4+", count: 0 },
    ]);
  });
});

describe("deckListGroupsOf", () => {
  test("every Core precon: every classifiable card appears exactly once, grouped hero-first then by aspect, each group sorted by name", () => {
    for (const starter of CORE_STARTER_DECKS) {
      const deck = deckFromStarterDeck(starter, "poolv1");
      const groups = deckListGroupsOf(deck, CORE_CARDS);
      expect(groups.length).toBeGreaterThan(0);
      expect(groups[0]!.key).toBe("hero"); // every Core precon has signature cards

      const keys = groups.map((g) => g.key);
      expect(new Set(keys).size).toBe(keys.length); // no group repeated

      for (const group of groups) {
        const names = group.entries.map((e) => e.name);
        expect(names).toEqual([...names].sort((a, b) => a.localeCompare(b)));
        expect(group.count).toBe(group.entries.reduce((sum, e) => sum + e.quantity, 0));
      }

      const stats = deckStatsOf(deck, CORE_CARDS);
      const totalGrouped = groups.reduce((sum, g) => sum + g.count, 0);
      // Every card deckStatsOf could classify by aspect is grouped here too — nothing silently dropped.
      const aspectTotal = Object.values(stats.countsByAspect).reduce((sum, n) => sum + n, 0);
      expect(totalGrouped).toBe(aspectTotal);
    }
  });

  test("a card id absent from the pool is skipped, not grouped", () => {
    const deck: Pick<Deck, "cards"> = { cards: [{ cardId: cardId("99999-does-not-exist"), quantity: 3 }] };
    expect(deckListGroupsOf(deck, CORE_CARDS)).toEqual([]);
  });

  test("Doctor Strange's Invocation cards never appear (they're never in deck.cards)", () => {
    const starter = WAVE1_STARTER_DECKS.find((d) => (d.id as string) === "drs-protection")!;
    const deck = deckFromStarterDeck(starter, "poolv1");
    const groups = deckListGroupsOf(deck, WAVE1_CARDS);
    const invocationIds = new Set(["09032", "09033", "09034", "09035", "09036"].map((id) => cardId(id)));
    for (const group of groups) for (const entry of group.entries) expect(invocationIds.has(entry.cardId)).toBe(false);
  });
});
