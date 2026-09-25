import { describe, expect, test } from "vitest";
import { CATALOG_CARD_COUNT, CORE_CARDS } from "@mc/content";
import { CORE_DEPS } from "@mc/cards";
import { cardPoolCoverageOf, cardPoolCoverageText } from "./card-pool-coverage.js";
import { POOL_CARDS, POOL_DEPS } from "../content/pool.js";

describe("cardPoolCoverageOf", () => {
  test("counts against the whole game, not just the pool", () => {
    const coverage = cardPoolCoverageOf(CORE_CARDS, CORE_DEPS);
    expect(coverage.totalCards).toBe(CATALOG_CARD_COUNT);
    expect(coverage.liveCards).toBeGreaterThan(0);
    expect(coverage.liveCards).toBeLessThan(coverage.totalCards);
  });

  test("counts printed cards: a villain's folded stages each count", () => {
    // More printed cards than app cards, since Core's villains carry their later stages' scans.
    expect(cardPoolCoverageOf(CORE_CARDS, CORE_DEPS).liveCards).toBeGreaterThan(CORE_CARDS.length);
  });

  test("an unscripted card isn't live; a card with no ability is", () => {
    const noScripts = cardPoolCoverageOf(CORE_CARDS, { abilities: {} }).liveCards;
    expect(noScripts).toBeGreaterThan(0);
    expect(noScripts).toBeLessThan(cardPoolCoverageOf(CORE_CARDS, CORE_DEPS).liveCards);
  });

  test("the app's own pool never reports more live than the whole game", () => {
    const coverage = cardPoolCoverageOf(POOL_CARDS, POOL_DEPS);
    expect(coverage.liveCards).toBeLessThanOrEqual(coverage.totalCards);
  });

  test("wording", () => {
    expect(cardPoolCoverageText({ liveCards: 1065, totalCards: 3678 })).toBe("1,065 / 3,678 cards live");
  });
});
