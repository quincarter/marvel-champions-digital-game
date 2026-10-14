import { describe, expect, test } from "vitest";
import { deckBuilderRowSizes } from "./deck-builder-rows.js";

describe("deckBuilderRowSizes", () => {
  test("Standard keeps the original 104 / 64 rows and the 62px thumbnail", () => {
    expect(deckBuilderRowSizes(1)).toEqual({ cardRowHeight: 104, cardThumbWidth: 62, identityRowHeight: 64 });
    expect(deckBuilderRowSizes()).toEqual(deckBuilderRowSizes(1));
  });

  test("rows and thumbnails grow with the factor", () => {
    const standard = deckBuilderRowSizes(1);
    const large = deckBuilderRowSizes(1.25);
    const xlarge = deckBuilderRowSizes(1.5);
    expect(large.cardRowHeight).toBeGreaterThan(standard.cardRowHeight);
    expect(xlarge.cardRowHeight).toBeGreaterThan(large.cardRowHeight);
    expect(xlarge.cardThumbWidth).toBeGreaterThan(standard.cardThumbWidth);
    expect(xlarge.identityRowHeight).toBe(96);
  });

  test("the thumbnail keeps the printed card's proportions inside the row", () => {
    for (const scale of [1, 1.25, 1.5]) {
      const { cardRowHeight, cardThumbWidth } = deckBuilderRowSizes(scale);
      const thumbHeight = cardRowHeight - 6 - 12;
      expect(cardThumbWidth / thumbHeight).toBeCloseTo(63 / 88, 1);
    }
  });

  test("a bad factor falls back to Standard", () => {
    expect(deckBuilderRowSizes(0)).toEqual(deckBuilderRowSizes(1));
  });
});
