import { describe, expect, test } from "vitest";
import { cardId, cycleId, setCode } from "../schema/ids.js";
import type { AnyCard } from "../schema/cards/index.js";
import { CORE_CARDS } from "./core/cards.js";
import { CORE_POOL_VERSION, poolVersionOf } from "./pool-version.js";

const stub = (overrides: Partial<AnyCard> = {}): AnyCard =>
  ({
    id: cardId("00001"),
    type: "resource",
    name: "Stub Card",
    setCode: setCode("core"),
    cycleId: cycleId("core"),
    collectorNumber: "1",
    quantityInSet: 1,
    unique: false,
    aspect: "basic",
    traits: [],
    deckLimit: 3,
    text: { current: "" },
    keywords: [],
    abilities: [],
    cost: 0,
    ...overrides,
  }) as unknown as AnyCard;

describe("poolVersionOf", () => {
  test("is deterministic for the same pool", () => {
    expect(poolVersionOf([stub()])).toBe(poolVersionOf([stub()]));
  });

  test("does not depend on pool order", () => {
    const a = stub({ id: cardId("00001") });
    const b = stub({ id: cardId("00002") });
    expect(poolVersionOf([a, b])).toBe(poolVersionOf([b, a]));
  });

  test("does not depend on a card's own key order", () => {
    const a: AnyCard = stub();
    // Same data, reconstructed with keys inserted in a different order.
    const reordered = Object.fromEntries(Object.entries(a).reverse()) as unknown as AnyCard;
    expect(poolVersionOf([a])).toBe(poolVersionOf([reordered]));
  });

  test("changes when a card is added, removed, or edited", () => {
    const base = poolVersionOf([stub()]);
    expect(poolVersionOf([stub(), stub({ id: cardId("00002") })])).not.toBe(base);
    expect(poolVersionOf([])).not.toBe(base);
    expect(poolVersionOf([stub({ name: "Edited" })])).not.toBe(base);
  });

  test("CORE_POOL_VERSION is stable across two computations of the real pool", () => {
    expect(poolVersionOf(CORE_CARDS)).toBe(CORE_POOL_VERSION);
  });

  test("CORE_POOL_VERSION is non-empty and looks like a version string, not a card list", () => {
    expect(CORE_POOL_VERSION).toMatch(/^v1-[0-9a-f]{8}$/);
  });
});
