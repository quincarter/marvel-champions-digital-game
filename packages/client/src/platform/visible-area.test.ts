import { describe, expect, it } from "vitest";
import { boxTrim, hiddenBottom, typingInto, waitsToSettle } from "./visible-area.js";

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
  it("still sees a phone's toolbar in landscape", () => {
    expect(hiddenBottom(375, 300, 0, 1)).toBe(75);
  });
});

describe("waitsToSettle", () => {
  it("holds a strip too tall to be a toolbar while a rotation may be under way (#629)", () => {
    expect(waitsToSettle(448, 768, false)).toBe(true);
  });
  it("believes a tall strip that still stands once the resizes have settled", () => {
    expect(waitsToSettle(81, 320, false)).toBe(true);
    expect(waitsToSettle(81, 320, true)).toBe(false);
  });
  it("never holds a toolbar-sized strip", () => {
    expect(waitsToSettle(80, 320, false)).toBe(false);
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
