import { describe, expect, it } from "vitest";
import { boxTrim, hiddenBottom, typingInto } from "./visible-area.js";

describe("hiddenBottom", () => {
  it("is how far the box hangs below the visible area", () => {
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

describe("boxTrim", () => {
  it("gives up half of the hidden strip, rounded", () => {
    expect(boxTrim(75)).toBe(38);
    expect(boxTrim(0)).toBe(0);
  });
});

describe("typingInto", () => {
  const element = (tagName: string, isContentEditable = false): Element =>
    ({ tagName, isContentEditable }) as unknown as Element;

  it("is true for a text field, where a shrunken visible area is the keyboard", () => {
    expect(typingInto(element("INPUT"))).toBe(true);
    expect(typingInto(element("TEXTAREA"))).toBe(true);
    expect(typingInto(element("DIV", true))).toBe(true);
  });
  it("is false with nothing focused or the canvas focused", () => {
    expect(typingInto(null)).toBe(false);
    expect(typingInto(element("CANVAS"))).toBe(false);
    expect(typingInto(element("BODY"))).toBe(false);
  });
});
