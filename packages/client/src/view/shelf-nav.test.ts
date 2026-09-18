import { describe, expect, test } from "vitest";
import { moveShelfFocus, type ShelfShape } from "./shelf-nav.js";

const shelves: readonly ShelfShape[] = [{ count: 3 }, { count: 1 }, { count: 5 }];

describe("moveShelfFocus", () => {
  test("left/right move within a shelf, clamped at its own ends", () => {
    expect(moveShelfFocus(shelves, { shelf: 0, item: 1 }, "right")).toEqual({ shelf: 0, item: 2 });
    expect(moveShelfFocus(shelves, { shelf: 0, item: 2 }, "right")).toEqual({ shelf: 0, item: 2 }); // last card, stays
    expect(moveShelfFocus(shelves, { shelf: 0, item: 0 }, "left")).toEqual({ shelf: 0, item: 0 }); // first card, stays
  });

  test("up/down move to the same index in the shelf above/below, clamped to that shelf's own size", () => {
    // Shelf 0 has 3 cards, shelf 1 has only 1 — index 2 clamps to 0.
    expect(moveShelfFocus(shelves, { shelf: 0, item: 2 }, "down")).toEqual({ shelf: 1, item: 0 });
    expect(moveShelfFocus(shelves, { shelf: 1, item: 0 }, "down")).toEqual({ shelf: 2, item: 0 });
    expect(moveShelfFocus(shelves, { shelf: 2, item: 3 }, "up")).toEqual({ shelf: 1, item: 0 });
  });

  test("up from the first shelf, or down from the last, stays put", () => {
    expect(moveShelfFocus(shelves, { shelf: 0, item: 1 }, "up")).toEqual({ shelf: 0, item: 1 });
    expect(moveShelfFocus(shelves, { shelf: 2, item: 1 }, "down")).toEqual({ shelf: 2, item: 1 });
  });

  test("home/end go to the current shelf's own first/last card", () => {
    expect(moveShelfFocus(shelves, { shelf: 2, item: 2 }, "home")).toEqual({ shelf: 2, item: 0 });
    expect(moveShelfFocus(shelves, { shelf: 2, item: 2 }, "end")).toEqual({ shelf: 2, item: 4 });
  });

  test("page up/down move by shelf, same as up/down at this granularity", () => {
    expect(moveShelfFocus(shelves, { shelf: 0, item: 0 }, "pageDown")).toEqual({ shelf: 1, item: 0 });
    expect(moveShelfFocus(shelves, { shelf: 1, item: 0 }, "pageUp")).toEqual({ shelf: 0, item: 0 });
  });

  test("pageDown from the last shelf goes to that shelf's own last card", () => {
    expect(moveShelfFocus(shelves, { shelf: 2, item: 0 }, "pageDown")).toEqual({ shelf: 2, item: 4 });
  });

  test("a stale position (a filter just dropped a shelf or shrank one) clamps rather than throwing", () => {
    expect(moveShelfFocus(shelves, { shelf: 9, item: 9 }, "left")).toEqual({ shelf: 2, item: 3 });
    expect(moveShelfFocus([], { shelf: 0, item: 0 }, "right")).toEqual({ shelf: 0, item: 0 });
  });

  test("a shelf with zero cards (shouldn't normally exist — empty shelves are dropped upstream) never produces a negative index", () => {
    const withEmpty: readonly ShelfShape[] = [{ count: 2 }, { count: 0 }];
    expect(moveShelfFocus(withEmpty, { shelf: 1, item: 0 }, "right")).toEqual({ shelf: 1, item: 0 });
  });
});
