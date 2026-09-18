import { describe, expect, test } from "vitest";
import { rectsOverlap } from "./layout.js";
import { titleMenuLayout, titleMenuLayoutRects } from "./title-menu-layout.js";

const SIZES: readonly { readonly width: number; readonly height: number }[] = [
  { width: 440, height: 900 },
  { width: 800, height: 600 },
  { width: 1280, height: 1000 },
];

describe("titleMenuLayout", () => {
  for (const size of SIZES) {
    for (const continuable of [false, true]) {
      test(`no two rows overlap at ${size.width}x${size.height}, continuable=${continuable}`, () => {
        const layout = titleMenuLayout({ ...size, continuable });
        const rects = titleMenuLayoutRects(layout);
        for (let i = 0; i < rects.length; i++) {
          for (let j = i + 1; j < rects.length; j++) {
            expect(rectsOverlap(rects[i]!, rects[j]!)).toBe(false);
          }
        }
      });

      test(`every row stays within the screen bounds at ${size.width}x${size.height}, continuable=${continuable}`, () => {
        const layout = titleMenuLayout({ ...size, continuable });
        for (const rect of titleMenuLayoutRects(layout)) {
          expect(rect.x).toBeGreaterThanOrEqual(0);
          expect(rect.x + rect.width).toBeLessThanOrEqual(size.width + 0.01);
        }
      });
    }
  }

  test("desktop and tablet split into an ink art panel and a paper menu panel, divided by a thin red rule", () => {
    const layout = titleMenuLayout({ width: 1280, height: 1000, continuable: false });
    expect(layout.split).toBe(true);
    expect(layout.artPanel).not.toBeNull();
    expect(layout.divider).not.toBeNull();
    expect(layout.artPanel!.x).toBe(0);
    expect(layout.divider!.x).toBe(layout.artPanel!.width);
    expect(layout.menuPanel.x).toBeGreaterThan(layout.divider!.x);
  });

  test("phone has no split — the menu panel is the whole screen", () => {
    const layout = titleMenuLayout({ width: 390, height: 844, continuable: false });
    expect(layout.split).toBe(false);
    expect(layout.artPanel).toBeNull();
    expect(layout.divider).toBeNull();
    expect(layout.menuPanel).toEqual({ x: 0, y: 0, width: 390, height: 844 });
  });

  test("continuable adds exactly one row above New game", () => {
    const without = titleMenuLayout({ width: 1280, height: 1000, continuable: false });
    const withContinue = titleMenuLayout({ width: 1280, height: 1000, continuable: true });
    expect(without.continueRow).toBeNull();
    expect(withContinue.continueRow).not.toBeNull();
    expect(withContinue.newGame.y).toBeGreaterThan(without.newGame.y);
  });
});
