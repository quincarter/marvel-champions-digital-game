import { describe, expect, test } from "vitest";
import { motion } from "../tokens.js";
import { GUIDE_GLIDE_MEMORY_MS, GuideGlide } from "./guide-glide.js";
import type { Rect } from "./layout.js";

const THWART: Rect = { x: 100, y: 500, width: 80, height: 40 };
const CARD: Rect = { x: 300, y: 300, width: 120, height: 160 };
const HALFWAY = motion.guideGlideMs / 2;

const middle: Rect = { x: 200, y: 400, width: 100, height: 100 };

describe("GuideGlide", () => {
  test("the first target is shown in place: there's nowhere to glide from", () => {
    const glide = new GuideGlide();
    expect(glide.place("thwart", THWART, 0, true)).toEqual(THWART);
    expect(glide.remainingMs(0)).toBe(0);
  });

  test("a new target glides from the old one, position and size together, and lands exactly", () => {
    const glide = new GuideGlide();
    glide.place("thwart", THWART, 0, true);
    expect(glide.place("card", CARD, 1000, true), "starts where the highlight was").toEqual(THWART);
    expect(glide.remainingMs(1000)).toBe(motion.guideGlideMs);
    const halfway = glide.rectAt(1000 + HALFWAY)!;
    expect(halfway.x).toBeCloseTo(middle.x);
    expect(halfway.y).toBeCloseTo(middle.y);
    expect(halfway.width).toBeCloseTo(middle.width);
    expect(halfway.height).toBeCloseTo(middle.height);
    expect(glide.rectAt(1000 + motion.guideGlideMs)).toEqual(CARD);
    expect(glide.remainingMs(1000 + motion.guideGlideMs)).toBe(0);
  });

  test("it eases: slower at the ends than through the middle", () => {
    const glide = new GuideGlide();
    glide.place("thwart", THWART, 0, true);
    glide.place("card", CARD, 0, true);
    const x = (ms: number): number => glide.rectAt(ms)!.x;
    const tenth = motion.guideGlideMs / 10;
    expect(x(tenth) - x(0)).toBeLessThan(x(HALFWAY + tenth / 2) - x(HALFWAY - tenth / 2));
  });

  test("a redraw mid-glide carries on rather than restarting", () => {
    const glide = new GuideGlide();
    glide.place("thwart", THWART, 0, true);
    glide.place("card", CARD, 0, true);
    const shown = glide.place("card", CARD, HALFWAY, true);
    expect(shown.x).toBeCloseTo(middle.x);
    expect(glide.remainingMs(HALFWAY)).toBe(HALFWAY);
  });

  test("a new target mid-glide starts from wherever the highlight has got to", () => {
    const glide = new GuideGlide();
    glide.place("thwart", THWART, 0, true);
    glide.place("card", CARD, 0, true);
    const other: Rect = { x: 0, y: 0, width: 10, height: 10 };
    expect(glide.place("pay", other, HALFWAY, true).x).toBeCloseTo(middle.x);
    expect(glide.remainingMs(HALFWAY)).toBe(motion.guideGlideMs);
  });

  test("the same target moving is followed at once, so the ring never trails its card", () => {
    const glide = new GuideGlide();
    glide.place("card", CARD, 0, true);
    const reflowed = { ...CARD, x: CARD.x + 40 };
    expect(glide.place("card", reflowed, 1000, true)).toEqual(reflowed);
    expect(glide.remainingMs(1000)).toBe(0);
  });

  test("a target that moves mid-glide redirects where the glide lands", () => {
    const glide = new GuideGlide();
    glide.place("thwart", THWART, 0, true);
    glide.place("card", CARD, 0, true);
    const reflowed = { ...CARD, x: CARD.x + 40 };
    glide.place("card", reflowed, HALFWAY, true);
    expect(glide.rectAt(motion.guideGlideMs)).toEqual(reflowed);
  });

  test("Reduced motion: every target is shown in place", () => {
    const glide = new GuideGlide();
    glide.place("thwart", THWART, 0, false);
    expect(glide.place("card", CARD, 1000, false)).toEqual(CARD);
    expect(glide.remainingMs(1000)).toBe(0);
  });

  test("Reduced motion turned on mid-glide lands at once", () => {
    const glide = new GuideGlide();
    glide.place("thwart", THWART, 0, true);
    glide.place("card", CARD, 0, true);
    expect(glide.place("card", CARD, HALFWAY, false)).toEqual(CARD);
    expect(glide.remainingMs(HALFWAY)).toBe(0);
  });

  test("a short gap between targets still glides from where the highlight was", () => {
    const glide = new GuideGlide();
    glide.place("thwart", THWART, 0, true);
    glide.hide(1000);
    expect(glide.place("card", CARD, 1000 + GUIDE_GLIDE_MEMORY_MS, true)).toEqual(THWART);
  });

  test("a long gap shows the next target in place", () => {
    const glide = new GuideGlide();
    glide.place("thwart", THWART, 0, true);
    glide.hide(1000);
    glide.hide(3000);
    expect(glide.recentRect(1000 + GUIDE_GLIDE_MEMORY_MS + 1)).toBeNull();
    expect(glide.place("card", CARD, 1000 + GUIDE_GLIDE_MEMORY_MS + 1, true)).toEqual(CARD);
    expect(glide.remainingMs(1000 + GUIDE_GLIDE_MEMORY_MS + 1)).toBe(0);
  });

  test("a resize forgets the position, so the next target is shown in place", () => {
    const glide = new GuideGlide();
    glide.place("thwart", THWART, 0, true);
    glide.forget();
    expect(glide.place("card", CARD, 1000, true)).toEqual(CARD);
  });

  test("a sheet's stamp glides in from the seed, even on the same key", () => {
    const glide = new GuideGlide();
    glide.seed(THWART, 0);
    expect(glide.place("stamp", CARD, 0, true)).toEqual(THWART);
    expect(glide.remainingMs(0)).toBe(motion.guideGlideMs);
  });
});
