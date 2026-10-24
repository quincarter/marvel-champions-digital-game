import { describe, expect, it } from "vitest";
import { hiddenBottom } from "./visible-area.js";

describe("hiddenBottom", () => {
  it("is the share of the layout viewport the visible area leaves uncovered", () => {
    expect(hiddenBottom(997, 922, 0, 1)).toBe(75);
  });
  it("accounts for the visible area's offset from the top", () => {
    expect(hiddenBottom(997, 900, 22, 1)).toBe(75);
  });
  it("is 0 when they match, within a pixel, or while pinch-zoomed", () => {
    expect(hiddenBottom(997, 997, 0, 1)).toBe(0);
    expect(hiddenBottom(997, 996.5, 0, 1)).toBe(0);
    expect(hiddenBottom(997, 500, 0, 2)).toBe(0);
  });
});
