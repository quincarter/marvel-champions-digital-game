import { describe, expect, it } from "vitest";
import {
  KEY_PICK_SLOTS,
  PAD_PICK_SLOTS,
  pagedOffset,
  pickIndexOfSlot,
  pickMoreText,
  pickSlotOfDigit,
  pickSlotOfIndex,
  pickSlotsOf,
  pickWindow,
} from "./pick-assign.js";

describe("pickWindow", () => {
  it("holds four candidates on a pad page and nine on a keyboard page", () => {
    expect(pickSlotsOf("pad")).toBe(PAD_PICK_SLOTS);
    expect(pickSlotsOf("keyboard")).toBe(KEY_PICK_SLOTS);
    expect(pickWindow(3, 0, 4)).toMatchObject({ start: 0, pageCount: 1, paged: false });
    expect(pickWindow(5, 0, 4)).toMatchObject({ start: 0, pageCount: 2, paged: true });
    expect(pickWindow(5, 4, 4)).toMatchObject({ start: 4, page: 1 });
  });

  it("clamps an offset past the end to the last page, and a negative one to the first", () => {
    expect(pickWindow(5, 99, 4).page).toBe(1);
    expect(pickWindow(5, -3, 4).page).toBe(0);
    expect(pickWindow(0, 0, 4)).toMatchObject({ pageCount: 1, paged: false, count: 0 });
  });

  it("finds the page by any index on it, so a size change keeps the candidate in view", () => {
    // Offset 4 on a four-slot page is page 1; the same offset on a nine-slot page is page 0.
    expect(pickWindow(10, 4, 4).page).toBe(1);
    expect(pickWindow(10, 4, 9).page).toBe(0);
  });
});

describe("slots and candidates", () => {
  it("maps A, X, Y, B (slots 0 to 3) to the page's candidates and leaves empty slots empty", () => {
    const first = pickWindow(6, 0, 4);
    expect([0, 1, 2, 3].map((slot) => pickIndexOfSlot(first, slot))).toEqual([0, 1, 2, 3]);
    const last = pickWindow(6, 4, 4);
    expect([0, 1, 2, 3].map((slot) => pickIndexOfSlot(last, slot))).toEqual([4, 5, null, null]);
    expect(pickIndexOfSlot(first, 4)).toBeNull();
    expect(pickIndexOfSlot(first, -1)).toBeNull();
  });

  it("is the inverse of itself for the candidates on the page", () => {
    const window = pickWindow(7, 4, 4);
    for (let index = 0; index < 7; index++) {
      const slot = pickSlotOfIndex(window, index);
      if (slot === null) expect(index < 4).toBe(true);
      else expect(pickIndexOfSlot(window, slot)).toBe(index);
    }
    expect(pickSlotOfIndex(window, 7)).toBeNull();
  });
});

describe("pagedOffset", () => {
  it("steps a page at a time and cycles past either end", () => {
    expect(pagedOffset(9, 0, 4, 1)).toBe(4);
    expect(pagedOffset(9, 4, 4, 1)).toBe(8);
    expect(pagedOffset(9, 8, 4, 1)).toBe(0);
    expect(pagedOffset(9, 0, 4, -1)).toBe(8);
    expect(pagedOffset(9, 8, 4, -1)).toBe(4);
  });

  it("stays on the first page when everything fits on one", () => {
    expect(pagedOffset(4, 0, 4, 1)).toBe(0);
    expect(pagedOffset(0, 0, 4, -1)).toBe(0);
  });
});

describe("number keys", () => {
  it("means slots 0 to 8 for Digit1 to Digit9 only", () => {
    expect(["Digit1", "Digit5", "Digit9"].map(pickSlotOfDigit)).toEqual([0, 4, 8]);
    expect(pickSlotOfDigit("Digit0")).toBeNull();
    expect(pickSlotOfDigit("Numpad1")).toBeNull();
    expect(pickSlotOfDigit("KeyA")).toBeNull();
  });
});

describe("pickMoreText", () => {
  it("names the page", () => {
    expect(pickMoreText(pickWindow(9, 4, 4))).toBe("more ▸ 2/3");
  });
});
