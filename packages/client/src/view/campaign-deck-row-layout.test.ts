import { describe, expect, test } from "vitest";
import { DECK_ROW_HEIGHT, deckRowLayout, deckRowTitleWidth } from "./campaign-deck-row-layout.js";

describe("deckRowLayout", () => {
  test("a wide panel keeps the count beside the name on one 44px row", () => {
    const row = deckRowLayout(460, "BISHOP · LEADERSHIP", "40 + 2 pinned", false);
    expect(row.stacked).toBe(false);
    expect(row.height).toBe(DECK_ROW_HEIGHT);
    expect(row.countY).toBe(row.titleY);
  });

  test("a narrow panel puts the count on its own line under the name (Piece 14, D9)", () => {
    const row = deckRowLayout(300, "BISHOP · LEADERSHIP", "40 + 2 pinned", false);
    expect(row.stacked).toBe(true);
    expect(row.countY).toBeGreaterThan(row.titleY + 14);
    expect(row.height).toBeGreaterThan(DECK_ROW_HEIGHT);
    expect(row.countY + 8).toBeLessThanOrEqual(row.height);
  });

  test("a problem line sits below the count and inside the row, stacked or not", () => {
    for (const width of [300, 460]) {
      const row = deckRowLayout(width, "BISHOP · LEADERSHIP", "40 + 2 pinned", true);
      expect(row.problemY).not.toBeNull();
      expect(row.problemY!).toBeGreaterThan(row.countY + (row.stacked ? 8 : -8));
      expect(row.problemY! + 16).toBeLessThanOrEqual(row.height);
    }
  });

  test("the name never reaches the count", () => {
    expect(deckRowTitleWidth(460, "40 + 2 pinned", false)).toBeLessThan(460 - 12 - 13 * 8);
    expect(deckRowTitleWidth(300, "40 + 2 pinned", true)).toBeGreaterThan(
      deckRowTitleWidth(300, "40 + 2 pinned", false),
    );
  });
});
