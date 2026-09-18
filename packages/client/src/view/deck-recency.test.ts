import { describe, expect, test } from "vitest";
import type { Deck } from "@mc/content";
import { recentlyChangedOf, sortByRecency } from "./deck-recency.js";

function stub(id: string, updatedAt?: string): Deck {
  return {
    id: id as Deck["id"],
    name: id,
    identityCardId: "01001" as Deck["identityCardId"],
    aspects: [],
    cards: [],
    poolVersion: "test",
    source: { kind: "userBuilt", createdAt: "2026-01-01T00:00:00.000Z" },
    ...(updatedAt ? { updatedAt } : {}),
  };
}

describe("sortByRecency", () => {
  test("most recently changed first", () => {
    const a = stub("a", "2026-09-01T00:00:00.000Z");
    const b = stub("b", "2026-09-15T00:00:00.000Z");
    const c = stub("c", "2026-09-10T00:00:00.000Z");
    expect(sortByRecency([a, b, c]).map((d) => d.id)).toEqual(["b", "c", "a"]);
  });

  test("a deck with no updatedAt (an old stored deck, or a precon) loads fine and sorts after every timestamped deck, in its given order", () => {
    const timeless1 = stub("old-1");
    const timeless2 = stub("old-2");
    const dated = stub("dated", "2026-09-01T00:00:00.000Z");
    expect(sortByRecency([timeless1, dated, timeless2]).map((d) => d.id)).toEqual(["dated", "old-1", "old-2"]);
  });

  test("every deck untimestamped: order is unchanged, and nothing throws", () => {
    const decks = [stub("a"), stub("b"), stub("c")];
    expect(sortByRecency(decks).map((d) => d.id)).toEqual(["a", "b", "c"]);
  });

  test("does not mutate its input", () => {
    const decks = [stub("a", "2026-09-01T00:00:00.000Z"), stub("b", "2026-09-15T00:00:00.000Z")];
    const copy = [...decks];
    sortByRecency(decks);
    expect(decks).toEqual(copy);
  });
});

describe("recentlyChangedOf", () => {
  test("only timestamped decks, most recent first, capped at the limit", () => {
    const decks = [stub("a", "2026-09-01T00:00:00.000Z"), stub("untimestamped"), stub("b", "2026-09-15T00:00:00.000Z"), stub("c", "2026-09-10T00:00:00.000Z")];
    expect(recentlyChangedOf(decks, 2).map((d) => d.id)).toEqual(["b", "c"]);
  });

  test("empty when nothing has ever been saved with a timestamp", () => {
    expect(recentlyChangedOf([stub("a"), stub("b")])).toEqual([]);
  });
});
