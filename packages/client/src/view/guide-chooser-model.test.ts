import { describe, expect, it } from "vitest";
import { rectsOverlap } from "./layout.js";
import {
  GUIDE_CHOOSER_OPTIONS,
  guideChooserFocusOrder,
  guideChooserLayout,
  guideChooserLayoutRects,
  guideChooserLessonChips,
} from "./guide-chooser-model.js";

describe("guideChooserLessonChips", () => {
  it("numbers the tutorial's real five lessons in order", () => {
    const chips = guideChooserLessonChips();
    expect(chips).toHaveLength(5);
    expect(chips[0]).toBe("1 · HOW TO WIN");
    expect(chips.every((c, i) => c.startsWith(`${i + 1} · `))).toBe(true);
  });
});

describe("guideChooserLayout", () => {
  const sizes: readonly [number, number][] = [
    [390, 844], // phone
    [1024, 768], // tablet landscape
    [1440, 900], // desktop
  ];

  for (const [width, height] of sizes) {
    it(`draws three options, Suit up, and no overlap at ${width}x${height}`, () => {
      const layout = guideChooserLayout(width, height);
      expect(layout.options).toHaveLength(GUIDE_CHOOSER_OPTIONS.length);
      const rects = guideChooserLayoutRects(layout);
      for (let i = 0; i < rects.length; i++) {
        for (let j = i + 1; j < rects.length; j++) {
          expect(rectsOverlap(rects[i]!, rects[j]!)).toBe(false);
        }
      }
      for (const rect of rects) {
        expect(rect.x).toBeGreaterThanOrEqual(0);
        expect(rect.y).toBeGreaterThanOrEqual(0);
        expect(rect.x + rect.width).toBeLessThanOrEqual(width + 1);
        expect(rect.y + rect.height).toBeLessThanOrEqual(height + 1);
      }
    });
  }

  it("is narrow (stacked) on phone and wide (split) on tablet landscape/desktop", () => {
    expect(guideChooserLayout(390, 844).wide).toBe(false);
    expect(guideChooserLayout(1024, 768).wide).toBe(true);
    expect(guideChooserLayout(1440, 900).wide).toBe(true);
  });

  it("gives every wide layout a Back button and every narrow one none", () => {
    expect(guideChooserLayout(1024, 768).back.width).toBeGreaterThan(0);
    expect(guideChooserLayout(1440, 900).back.width).toBeGreaterThan(0);
    expect(guideChooserLayout(390, 844).back.width).toBe(0);
  });

  it("reserves a lesson-chips row on wide layouts only", () => {
    expect(guideChooserLayout(1440, 900).chipsRow.width).toBeGreaterThan(0);
    expect(guideChooserLayout(390, 844).chipsRow.width).toBe(0);
  });
});

describe("guideChooserFocusOrder", () => {
  it("walks the three options, then Back (wide) or not (narrow), then Suit up", () => {
    expect(guideChooserFocusOrder(false)).toEqual(["option:full", "option:hints", "option:off", "suit-up"]);
    expect(guideChooserFocusOrder(true)).toEqual(["option:full", "option:hints", "option:off", "back", "suit-up"]);
  });
});
