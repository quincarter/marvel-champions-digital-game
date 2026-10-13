import { describe, expect, test } from "vitest";
import { rectsOverlap } from "./layout.js";
import { titleMenuLayout, titleMenuLayoutRects, updateBannerParts } from "./title-menu-layout.js";

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

  test("Civil War! is one more row directly under Campaign, absent (null) until the box is open", () => {
    const closed = titleMenuLayout({ width: 1280, height: 1000, continuable: false });
    const open = titleMenuLayout({ width: 1280, height: 1000, continuable: false, civilWar: true });
    expect(closed.civilWar).toBeNull();
    expect(open.civilWar).not.toBeNull();
    expect(open.civilWar!.y).toBeGreaterThan(open.campaign.y + open.campaign.height - 1);
    expect(open.extras.y).toBeGreaterThan(open.civilWar!.y);
    expect(titleMenuLayoutRects(closed)).toHaveLength(titleMenuLayoutRects(open).length - 1);
  });

  for (const size of [
    { width: 390, height: 844 },
    { width: 360, height: 800 },
    { width: 360, height: 740 },
    { width: 1024, height: 768 },
    { width: 1440, height: 900 },
  ]) {
    test(`every row (Continue, Civil War!, the update banner) shows without overlap, on screen, at ${size.width}x${size.height}`, () => {
      const layout = titleMenuLayout({ ...size, continuable: true, civilWar: true, update: true });
      const rects = titleMenuLayoutRects(layout);
      for (let i = 0; i < rects.length; i++) {
        for (let j = i + 1; j < rects.length; j++) expect(rectsOverlap(rects[i]!, rects[j]!)).toBe(false);
      }
      for (const rect of rects) {
        expect(rect.x).toBeGreaterThanOrEqual(0);
        expect(rect.y).toBeGreaterThanOrEqual(0);
        expect(rect.x + rect.width).toBeLessThanOrEqual(size.width);
        expect(rect.y + rect.height).toBeLessThanOrEqual(size.height);
      }
      expect(layout.footer.y + layout.footer.height).toBeLessThanOrEqual(size.height);
    });
  }

  test("continuable adds exactly one row above New game", () => {
    const without = titleMenuLayout({ width: 1280, height: 1000, continuable: false });
    const withContinue = titleMenuLayout({ width: 1280, height: 1000, continuable: true });
    expect(without.continueRow).toBeNull();
    expect(withContinue.continueRow).not.toBeNull();
    expect(withContinue.newGame.y).toBeGreaterThan(without.newGame.y);
  });

  test("no update, no banner, and the menu is where it always was", () => {
    const plain = titleMenuLayout({ width: 1280, height: 1000, continuable: true });
    expect(plain.updateBanner).toBeNull();
    expect(titleMenuLayout({ width: 1280, height: 1000, continuable: true, update: false })).toEqual(plain);
  });

  test("on a split screen the update banner sits in the art panel and moves nothing", () => {
    const plain = titleMenuLayout({ width: 1280, height: 1000, continuable: true });
    const offered = titleMenuLayout({ width: 1280, height: 1000, continuable: true, update: true });
    const banner = offered.updateBanner!;
    expect(banner.x).toBeGreaterThanOrEqual(0);
    expect(banner.x + banner.width).toBeLessThanOrEqual(offered.artPanel!.width);
    expect({ ...offered, updateBanner: null }).toEqual(plain);
  });

  test("on a phone the update banner heads the column, above everything else, with no overlap", () => {
    for (const continuable of [false, true]) {
      const plain = titleMenuLayout({ width: 390, height: 844, continuable });
      const offered = titleMenuLayout({ width: 390, height: 844, continuable, update: true });
      const banner = offered.updateBanner!;
      expect(banner.x).toBe(offered.left);
      expect(banner.width).toBe(offered.column);
      expect(banner.y + banner.height).toBeLessThanOrEqual(offered.eyebrow.y);
      expect(offered.newGame.y).toBeGreaterThan(plain.newGame.y);
      expect(offered.footer.y + 20).toBeLessThanOrEqual(844);
      const rects = titleMenuLayoutRects(offered);
      for (let i = 0; i < rects.length; i++) {
        for (let j = i + 1; j < rects.length; j++) expect(rectsOverlap(rects[i]!, rects[j]!)).toBe(false);
      }
    }
  });

  test("the banner's buttons are touch-sized, inside it, and leave the text its room", () => {
    // 1280 fits one row; a phone and a portrait tablet's art panel stack the buttons under the text.
    for (const [width, height] of [
      [390, 844],
      [360, 780],
      [768, 1024],
      [1024, 768],
      [1280, 1000],
    ] as const) {
      const banner = titleMenuLayout({ width, height, continuable: false, update: true }).updateBanner!;
      for (const actions of [1, 2]) {
        const parts = updateBannerParts(banner, actions);
        expect(parts.buttons).toHaveLength(actions);
        for (const button of parts.buttons) {
          expect(button.height).toBeGreaterThanOrEqual(44);
          expect(button.x).toBeGreaterThanOrEqual(banner.x);
          expect(button.x + button.width).toBeLessThanOrEqual(banner.x + banner.width);
          expect(button.y + button.height).toBeLessThanOrEqual(banner.y + banner.height);
        }
        if (actions === 2) expect(rectsOverlap(parts.buttons[0]!, parts.buttons[1]!)).toBe(false);
        // The close button is touch-sized, inside the banner, and clear of the text and every action button.
        const close = parts.dismiss;
        expect(close.width).toBeGreaterThanOrEqual(44);
        expect(close.height).toBeGreaterThanOrEqual(44);
        expect(close.x).toBeGreaterThanOrEqual(banner.x);
        expect(close.x + close.width).toBeLessThanOrEqual(banner.x + banner.width);
        expect(close.y).toBeGreaterThanOrEqual(banner.y);
        expect(close.y + close.height).toBeLessThanOrEqual(banner.y + banner.height);
        for (const button of parts.buttons) expect(rectsOverlap(close, button), `${width}`).toBe(false);
        expect(parts.text.x + parts.textWidth).toBeLessThanOrEqual(close.x);
        // The two lines of text (32px tall, 116 wide at most) clear every button.
        const text = { x: parts.text.x, y: parts.text.y, width: 116, height: 32 };
        expect(parts.textWidth).toBeGreaterThanOrEqual(text.width);
        expect(text.x + text.width).toBeLessThanOrEqual(banner.x + banner.width);
        for (const button of parts.buttons) expect(rectsOverlap(text, button)).toBe(false);
      }
    }
  });
});
