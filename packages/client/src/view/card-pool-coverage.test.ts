import { describe, expect, test } from "vitest";
import { CORE_CARDS } from "@mc/content";
import { CORE_DEPS } from "@mc/cards";
import { cardPoolCoverageOf, cardPoolCoverageText } from "./card-pool-coverage.js";
import { POOL_CARDS, POOL_DEPS } from "../content/pool.js";

describe("cardPoolCoverageOf", () => {
  test("every Core card with an ability is scripted under CORE_DEPS", () => {
    const coverage = cardPoolCoverageOf(CORE_CARDS, CORE_DEPS);
    expect(coverage.totalCards).toBeGreaterThan(0);
    expect(coverage.scriptedCards).toBe(coverage.totalCards);
  });

  test("an empty registry scripts nothing that needs a script", () => {
    const coverage = cardPoolCoverageOf(CORE_CARDS, { abilities: {} });
    expect(coverage.scriptedCards).toBe(0);
    expect(coverage.totalCards).toBeGreaterThan(0);
  });

  test("the app's own pool never reports more scripted than total", () => {
    const coverage = cardPoolCoverageOf(POOL_CARDS, POOL_DEPS);
    expect(coverage.scriptedCards).toBeLessThanOrEqual(coverage.totalCards);
  });

  test("wording", () => {
    expect(cardPoolCoverageText({ scriptedCards: 233, totalCards: 233 })).toBe("233 / 233 cards live");
  });
});
