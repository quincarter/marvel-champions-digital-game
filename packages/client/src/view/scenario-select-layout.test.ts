import { describe, expect, test } from "vitest";
import { rectsOverlap } from "./layout.js";
import { DETAIL_COLLAPSED_HEIGHT, scenarioSelectLayout, scenarioSelectLayoutRects } from "./scenario-select-layout.js";

const SIZES: readonly { readonly width: number; readonly height: number }[] = [
  { width: 390, height: 844 }, // phone
  { width: 768, height: 1024 }, // tablet portrait
  { width: 1024, height: 768 }, // tablet landscape
  { width: 1440, height: 900 }, // desktop
  { width: 1870, height: 1050 }, // desktop, the owner's own check size
];

describe("scenarioSelectLayout", () => {
  for (const size of SIZES) {
    for (const detailLines of [4, 14]) {
      test(`no overlap at ${size.width}x${size.height}, detailLines=${detailLines}`, () => {
        const layout = scenarioSelectLayout({ ...size, chipRows: 1, detailLines });
        const rects = scenarioSelectLayoutRects(layout);
        for (let i = 0; i < rects.length; i++) {
          for (let j = i + 1; j < rects.length; j++) {
            expect(rectsOverlap(rects[i]!, rects[j]!)).toBe(false);
          }
        }
      });

      test(`"Choose heroes" stays reachable (within bounds) at ${size.width}x${size.height}, detailLines=${detailLines}`, () => {
        const layout = scenarioSelectLayout({ ...size, chipRows: 1, detailLines });
        expect(layout.next.y + layout.next.height).toBeLessThanOrEqual(size.height + 0.01);
      });
    }
  }

  test("wide (desktop/tabletLandscape) gets a two-column split; narrow (phone/tabletPortrait) stacks one column", () => {
    expect(scenarioSelectLayout({ width: 1440, height: 900, chipRows: 1, detailLines: 4 }).wide).toBe(true);
    expect(scenarioSelectLayout({ width: 1024, height: 768, chipRows: 1, detailLines: 4 }).wide).toBe(true);
    expect(scenarioSelectLayout({ width: 390, height: 844, chipRows: 1, detailLines: 4 }).wide).toBe(false);
    expect(scenarioSelectLayout({ width: 768, height: 1024, chipRows: 1, detailLines: 4 }).wide).toBe(false);
  });

  test("wide: the detail panel runs the full body height, and the shelves + detail columns sit side by side", () => {
    const layout = scenarioSelectLayout({ width: 1440, height: 900, chipRows: 1, detailLines: 4 });
    expect(layout.detail.x).toBeGreaterThan(layout.shelves.x + layout.shelves.width);
    expect(layout.detail.y).toBeLessThan(layout.shelves.y);
    expect(layout.detail.height).toBeGreaterThan(layout.shelves.height);
    // "Choose heroes ▸" is pinned at the detail panel's own foot, not detached from it.
    expect(layout.next.x).toBeGreaterThanOrEqual(layout.detail.x);
    expect(layout.next.x + layout.next.width).toBeLessThanOrEqual(layout.detail.x + layout.detail.width + 0.01);
    expect(layout.next.y + layout.next.height).toBeLessThanOrEqual(layout.detail.y + layout.detail.height + 0.01);
  });

  test("narrow: the CTA is a full-width row at the screen's own foot, below the detail block, clear of the shelves", () => {
    const layout = scenarioSelectLayout({ width: 390, height: 844, chipRows: 1, detailLines: 4 });
    // Full width of the column (the open sheet is a few pixels wider, to cover the strokes of what it overlays).
    expect(layout.next.width).toBe(layout.search.width);
    expect(layout.next.y).toBeGreaterThan(layout.detail.y);
    expect(rectsOverlap(layout.next, layout.shelves)).toBe(false);
    expect(rectsOverlap(layout.next, layout.detail)).toBe(false);
  });

  test("the shelves viewport never collapses to nothing, even with a long detail panel", () => {
    const layout = scenarioSelectLayout({ width: 400, height: 700, chipRows: 2, detailLines: 40 });
    expect(layout.shelves.height).toBeGreaterThan(0);
  });

  test("the header bar spans the full width, with Back and the step label inside it", () => {
    const layout = scenarioSelectLayout({ width: 1024, height: 900, chipRows: 1, detailLines: 4 });
    expect(layout.headerBar).toEqual({ x: 0, y: 0, width: 1024, height: layout.headerBar.height });
    expect(layout.back.y).toBeGreaterThanOrEqual(layout.headerBar.y);
    expect(layout.back.y + layout.back.height).toBeLessThanOrEqual(layout.headerBar.y + layout.headerBar.height);
    expect(layout.step.x + layout.step.width).toBeLessThanOrEqual(layout.headerBar.x + layout.headerBar.width);
    expect(layout.step.x).toBeGreaterThan(layout.back.x + layout.back.width);
  });

  test("a taller viewport gives the shelves more room than a short one", () => {
    const tall = scenarioSelectLayout({ width: 1280, height: 1200, chipRows: 1, detailLines: 4 });
    const short = scenarioSelectLayout({ width: 800, height: 700, chipRows: 1, detailLines: 4 });
    expect(tall.shelves.height).toBeGreaterThanOrEqual(short.shelves.height);
  });

  test("statStripRows is 1 (wide, four cells across) or 2 (narrow, 2×2) — narrow cells don't fit 'Starting threat'/'Villain HP · stage I' four across (2026-09-18 fidelity pass)", () => {
    expect(scenarioSelectLayout({ width: 1440, height: 900, chipRows: 1, detailLines: 4 }).statStripRows).toBe(1);
    expect(scenarioSelectLayout({ width: 1024, height: 768, chipRows: 1, detailLines: 4 }).statStripRows).toBe(1);
    expect(scenarioSelectLayout({ width: 390, height: 844, chipRows: 1, detailLines: 4 }).statStripRows).toBe(2);
    expect(scenarioSelectLayout({ width: 768, height: 1024, chipRows: 1, detailLines: 4 }).statStripRows).toBe(2);
  });

  test("a 2-row stat strip is twice as tall as a 1-row one", () => {
    const narrow = scenarioSelectLayout({ width: 390, height: 844, chipRows: 1, detailLines: 4 });
    const wide = scenarioSelectLayout({ width: 1440, height: 900, chipRows: 1, detailLines: 4 });
    expect(narrow.statStrip.height).toBeCloseTo(wide.statStrip.height * 2, 0);
  });

  test("the stat strip sits below the shelves and above the CTA area, spanning the shelves column", () => {
    const layout = scenarioSelectLayout({ width: 1440, height: 900, chipRows: 1, detailLines: 4 });
    expect(layout.statStrip.y).toBeGreaterThanOrEqual(layout.shelves.y + layout.shelves.height);
    expect(layout.statStrip.width).toBeCloseTo(layout.shelves.width, 0);
  });
  test("narrow: shut, the stages panel is one bar and the stat strip folds away with it, so the shelves get the room", () => {
    for (const size of [
      { width: 375, height: 667 },
      { width: 412, height: 924 },
    ]) {
      const shut = scenarioSelectLayout({ ...size, chipRows: 2, detailLines: 12, detailCollapsed: true });
      expect(shut.detailOverlay).toBe(false);
      expect(shut.detail.height).toBe(DETAIL_COLLAPSED_HEIGHT);
      expect(shut.statStrip.height).toBe(0);
      // An iPhone SE has to be able to show a scenario card, not a sliver of one.
      expect(shut.shelves.height).toBeGreaterThanOrEqual(230);
      expect(shut.detail.y + shut.detail.height).toBeLessThanOrEqual(shut.footer.y);
      const rects = scenarioSelectLayoutRects(shut);
      for (let i = 0; i < rects.length; i++)
        for (let j = i + 1; j < rects.length; j++) expect(rectsOverlap(rects[i]!, rects[j]!)).toBe(false);
    }
  });

  test("narrow: open, the panel is a sheet over the chips and shelves; its bar has not moved, and the roster keeps its shut geometry", () => {
    for (const size of [
      { width: 375, height: 667 },
      { width: 412, height: 924 },
    ]) {
      const shut = scenarioSelectLayout({ ...size, chipRows: 2, detailLines: 12, detailCollapsed: true });
      const open = scenarioSelectLayout({ ...size, chipRows: 2, detailLines: 12, detailCollapsed: false });
      expect(open.detailOverlay).toBe(true);
      expect(open.shelves).toEqual(shut.shelves);
      // It covers the chips entirely, stroke and all.
      expect(open.detail.y).toBeLessThan(open.chips.y);
      // The bar is the sheet's last row, exactly where the shut bar was.
      expect(open.detail.y + open.detail.height).toBe(shut.detail.y + shut.detail.height);
      // The strip sits inside the sheet, and the sheet never reaches the search field or the CTA.
      expect(open.statStrip.y).toBeGreaterThanOrEqual(open.detail.y);
      expect(open.statStrip.y + open.statStrip.height).toBeLessThan(
        open.detail.y + open.detail.height - DETAIL_COLLAPSED_HEIGHT,
      );
      expect(rectsOverlap(open.detail, open.next)).toBe(false);
      // The sheet covers the search row too when it is open (the scene hides the DOM field while the sheet is up).
      const openWithSearch = scenarioSelectLayout({
        ...size,
        chipRows: 2,
        detailLines: 12,
        detailCollapsed: false,
        searchOpen: true,
      });
      expect(rectsOverlap(openWithSearch.detail, openWithSearch.search)).toBe(true);
      // Room for three stage boxes under the strip even on the small phone.
      expect(open.detail.height - DETAIL_COLLAPSED_HEIGHT - (open.statStrip.height + 26)).toBeGreaterThanOrEqual(
        3 * 52,
      );
    }
  });

  test("narrow: the search field is behind a toggle at the head of the chip rail — no row reserved while off, a 44px row under the chips while on; wide always draws the field", () => {
    for (const size of [
      { width: 390, height: 844 },
      { width: 768, height: 1024 },
    ]) {
      const off = scenarioSelectLayout({ ...size, chipRows: 2, detailLines: 12, detailCollapsed: true });
      expect(off.chipsScroll).toBe(true);
      expect(off.searchToggle).not.toBeNull();
      expect(off.search.height).toBe(0);
      expect(off.searchToggle!.y).toBe(off.chips.y);
      expect(off.searchToggle!.x + off.searchToggle!.width).toBeLessThanOrEqual(off.chips.x);
      // The chip row is the first thing under the header bar: no blank band above it.
      expect(off.chips.y).toBeLessThanOrEqual(off.headerBar.height + 24);
      const on = scenarioSelectLayout({
        ...size,
        chipRows: 2,
        detailLines: 12,
        detailCollapsed: true,
        searchOpen: true,
      });
      expect(on.search.height).toBe(44);
      expect(on.search.y).toBeGreaterThanOrEqual(on.chips.y + on.chips.height);
      expect(on.search.y + on.search.height).toBeLessThanOrEqual(on.shelves.y);
      expect(on.chips).toEqual(off.chips);
      expect(off.shelves.height - on.shelves.height).toBe(44 + 8);
      for (const layout of [off, on]) {
        const rects = scenarioSelectLayoutRects(layout);
        for (let i = 0; i < rects.length; i++)
          for (let j = i + 1; j < rects.length; j++) expect(rectsOverlap(rects[i]!, rects[j]!)).toBe(false);
      }
    }
    const wide = scenarioSelectLayout({ width: 1440, height: 900, chipRows: 2, detailLines: 4 });
    expect(wide.chipsScroll).toBe(false);
    expect(wide.searchToggle).toBeNull();
    expect(wide.search.height).toBe(44);
    expect(wide.search.y).toBeLessThan(wide.chips.y);
  });

  test("wide ignores the collapsed flag: the side panel costs the shelves nothing, so it stays open", () => {
    const a = scenarioSelectLayout({ width: 1440, height: 900, chipRows: 1, detailLines: 12 });
    const b = scenarioSelectLayout({ width: 1440, height: 900, chipRows: 1, detailLines: 12, detailCollapsed: true });
    expect(b.detail).toEqual(a.detail);
  });
});

describe("scenarioSelectLayout: the second action (Customize this scenario)", () => {
  for (const size of SIZES) {
    test(`at ${size.width}x${size.height} it sits clear of the CTA, the caption and the other regions`, () => {
      const base = scenarioSelectLayout({ ...size, chipRows: 1, detailLines: 4 });
      expect(base.secondary).toBeNull();
      for (const detailCollapsed of [true, false]) {
        const layout = scenarioSelectLayout({
          ...size,
          chipRows: 1,
          detailLines: 4,
          detailCollapsed,
          secondaryAction: true,
        });
        const second = layout.secondary!;
        expect(second.height).toBeGreaterThanOrEqual(44);
        expect(second.y + second.height).toBeLessThanOrEqual(layout.next.y);
        expect(rectsOverlap(second, layout.next)).toBe(false);
        expect(rectsOverlap(second, layout.footer)).toBe(false);
        for (const rect of scenarioSelectLayoutRects(layout)) {
          if (rect === layout.detail && layout.wide) continue;
          expect(rectsOverlap(second, rect)).toBe(false);
        }
      }
    });
  }
});

describe("scenarioSelectLayout with the chips behind the Filters button", () => {
  const sizes = [...SIZES, { width: 900, height: 700 }, { width: 1280, height: 800 }];
  for (const size of sizes) {
    for (const open of [false, true]) {
      test(`no overlap at ${size.width}x${size.height}, chips ${open ? "open" : "shut"}`, () => {
        const layout = scenarioSelectLayout({
          ...size,
          chipRows: open ? 3 : 0,
          detailLines: 8,
          detailCollapsed: true,
          filtersButton: true,
          chipsShown: open,
        });
        expect(layout.filtersButton).not.toBeNull();
        const rects = scenarioSelectLayoutRects(layout);
        for (let i = 0; i < rects.length; i++)
          for (let j = i + 1; j < rects.length; j++) expect(rectsOverlap(rects[i]!, rects[j]!)).toBe(false);
      });
    }
  }

  test("wide: the button sits right of the search field on its row; shut, the shelves take the chips' space", () => {
    const shut = scenarioSelectLayout({ width: 1280, height: 800, chipRows: 0, detailLines: 8, filtersButton: true });
    const always = scenarioSelectLayout({ width: 1280, height: 800, chipRows: 4, detailLines: 8 });
    expect(shut.filtersButton!.y).toBe(shut.search.y);
    expect(shut.filtersButton!.x).toBeGreaterThanOrEqual(shut.search.x + shut.search.width);
    expect(shut.shelves.y).toBeLessThan(always.shelves.y);
    expect(always.filtersButton).toBeNull();
  });

  test("narrow: the button takes the rail's place beside the search toggle; the rail is a second row only while open", () => {
    const base = { width: 390, height: 844, chipRows: 1, detailLines: 4, detailCollapsed: true } as const;
    const shut = scenarioSelectLayout({ ...base, filtersButton: true });
    const open = scenarioSelectLayout({ ...base, filtersButton: true, chipsShown: true });
    const rail = scenarioSelectLayout(base);
    expect(shut.chips.height).toBe(0);
    expect(shut.filtersButton!.y).toBe(shut.searchToggle!.y);
    expect(open.chips.height).toBeGreaterThan(0);
    expect(open.chips.y).toBeGreaterThan(open.filtersButton!.y);
    expect(open.shelves.y).toBeGreaterThan(shut.shelves.y);
    expect(shut.shelves.height).toBeGreaterThanOrEqual(rail.shelves.height);
  });
});
