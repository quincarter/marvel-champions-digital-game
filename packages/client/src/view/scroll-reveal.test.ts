import { describe, expect, test } from "vitest";
import { revealDelta } from "./scroll-reveal.js";

const viewport = { top: 100, bottom: 500 };

describe("revealDelta", () => {
  test("an item already inside the viewport needs no scroll", () => {
    expect(revealDelta(viewport, { top: 150, bottom: 200 })).toBe(0);
  });

  test("an item below the viewport scrolls down just far enough, with the margin", () => {
    expect(revealDelta(viewport, { top: 480, bottom: 560 })).toBe(68);
  });

  test("an item above the viewport scrolls up", () => {
    expect(revealDelta(viewport, { top: 60, bottom: 110 })).toBe(-48);
  });

  test("an item taller than the viewport lines its top up", () => {
    expect(revealDelta(viewport, { top: 300, bottom: 900 })).toBe(192);
  });
});
