import { describe, expect, test } from "vitest";
import { rectsOverlap, type Rect } from "./layout.js";
import { tallActionsLayout, wideActionsLayout, type GameOverActionsLayout } from "./game-over-actions-layout.js";

/** Three rematch buttons (a Civil War game the builder's Random made) and Back to title. */
const THREE = 3;

function expectClean(layout: GameOverActionsLayout, size: { width: number; height: number }): void {
  const rects: Rect[] = [...layout.actions, layout.back];
  for (const rect of rects) {
    expect(rect.x).toBeGreaterThanOrEqual(0);
    expect(rect.y).toBeGreaterThanOrEqual(0);
    expect(rect.x + rect.width).toBeLessThanOrEqual(size.width);
    expect(rect.y + rect.height).toBeLessThanOrEqual(size.height);
  }
  for (let i = 0; i < rects.length; i++) {
    for (let j = i + 1; j < rects.length; j++) expect(rectsOverlap(rects[i]!, rects[j]!)).toBe(false);
  }
}

describe("wideActionsLayout with three rematch buttons", () => {
  for (const size of [
    { width: 1440, height: 900 },
    { width: 1024, height: 768 },
  ]) {
    test(`stays on screen and below the table panel at ${size.width}x${size.height}`, () => {
      const pad = Math.round(Math.min(48, size.width * 0.034));
      const sideWidth = Math.round(Math.min(330, size.width * 0.24));
      const tableBottom = 290;
      const layout = wideActionsLayout({
        sideX: size.width - pad - sideWidth,
        sideWidth,
        tableBottom,
        bodyBottom: size.height - pad,
        actions: THREE,
      });
      expectClean(layout, size);
      expect(layout.actions).toHaveLength(THREE);
      expect(layout.actions[0]!.y).toBeGreaterThanOrEqual(tableBottom);
      expect(layout.overflow).toBe(0);
    });
  }

  test("shortens the buttons to the touch floor when a four-hero table leaves little room, never off screen", () => {
    const roomy = wideActionsLayout({ sideX: 1000, sideWidth: 300, tableBottom: 200, bodyBottom: 880, actions: THREE });
    const tight = wideActionsLayout({ sideX: 1000, sideWidth: 300, tableBottom: 520, bodyBottom: 760, actions: THREE });
    expect(tight.actions[0]!.height).toBeLessThan(roomy.actions[0]!.height);
    expect(tight.actions[0]!.height).toBeGreaterThanOrEqual(44);
    expect(tight.back.y + tight.back.height).toBeLessThanOrEqual(760);
  });
});

describe("tallActionsLayout with three rematch buttons", () => {
  for (const size of [
    { width: 390, height: 844 },
    { width: 360, height: 740 },
    { width: 768, height: 1024 },
  ]) {
    test(`stays on screen with room above at ${size.width}x${size.height}`, () => {
      const layout = tallActionsLayout({
        pad: 16,
        column: size.width - 32,
        ...size,
        top: size.height * 0.55,
        actions: THREE,
      });
      expectClean(layout, size);
      expect(layout.actions).toHaveLength(THREE);
      expect(layout.actions[0]!.width).toBe(size.width - 32);
      expect(layout.overflow).toBe(0);
    });
  }

  test("reports how far the content reaches into the buttons instead of moving them off screen", () => {
    const size = { width: 360, height: 740 };
    const layout = tallActionsLayout({ pad: 16, column: 328, ...size, top: 650, actions: THREE });
    expectClean(layout, size);
    expect(layout.overflow).toBeGreaterThan(0);
  });

  test("two rematch buttons (every other game) still fit with Back to title in one row", () => {
    const layout = tallActionsLayout({ pad: 16, column: 358, width: 390, height: 844, top: 400, actions: 2 });
    expect(layout.back.y).toBe(layout.actions[1]!.y);
    expectClean(layout, { width: 390, height: 844 });
  });
});
