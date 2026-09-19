import { describe, expect, test } from "vitest";
import { rectsOverlap } from "./layout.js";
import { deckCheckLayout, deckCheckLayoutRects } from "./deck-check-layout.js";

/** docs/phase4-screen-gaps.md §0/§5: phone, both tablet orientations, desktop, and the wide desktop size other rebuilt setup screens are checked at (1870×1050), plus the legacy sizes this layout was already checked at. */
const VIEWPORTS = [
  { name: "375×812", width: 375, height: 812 },
  { name: "phone (390×844)", width: 390, height: 844 },
  { name: "portrait phone (legacy)", width: 440, height: 900 },
  { name: "800×600", width: 800, height: 600 },
  { name: "tablet portrait (768×1024)", width: 768, height: 1024 },
  { name: "tablet landscape (1024×768)", width: 1024, height: 768 },
  { name: "desktop (1440×900)", width: 1440, height: 900 },
  { name: "wide desktop (1870×1050)", width: 1870, height: 1050 },
];

describe("deckCheckLayout", () => {
  for (const { name, width, height } of VIEWPORTS) {
    describe(name, () => {
      test("no two rects overlap", () => {
        const layout = deckCheckLayout({ width, height });
        const rects = deckCheckLayoutRects(layout);
        for (let i = 0; i < rects.length; i++) {
          for (let j = i + 1; j < rects.length; j++) {
            expect(rectsOverlap(rects[i]!, rects[j]!), `rect ${i} overlaps rect ${j}`).toBe(false);
          }
        }
      });

      test("Edit deck and Start game never overlap each other, and sit inside whichever of panel/footer hosts them", () => {
        const layout = deckCheckLayout({ width, height });
        expect(rectsOverlap(layout.editDeck, layout.startGame)).toBe(false);
        const host = layout.wide ? layout.panel! : layout.footer!;
        for (const button of [layout.editDeck, layout.startGame]) {
          expect(button.y).toBeGreaterThanOrEqual(host.y);
          expect(button.y + button.height).toBeLessThanOrEqual(host.y + host.height);
          expect(button.x).toBeGreaterThanOrEqual(host.x);
          expect(button.x + button.width).toBeLessThanOrEqual(host.x + host.width);
        }
      });

      test("every rect stays within the screen bounds", () => {
        const layout = deckCheckLayout({ width, height });
        for (const rect of deckCheckLayoutRects(layout)) {
          expect(rect.x).toBeGreaterThanOrEqual(0);
          expect(rect.x + rect.width).toBeLessThanOrEqual(width + 0.001);
          expect(rect.y).toBeGreaterThanOrEqual(0);
          expect(rect.y + rect.height).toBeLessThanOrEqual(height + 0.001);
        }
      });

      test("exactly one of (rail & cards & panel) or (tabs & content & footer) is populated", () => {
        const layout = deckCheckLayout({ width, height });
        if (layout.wide) {
          expect(layout.rail).not.toBeNull();
          expect(layout.cards).not.toBeNull();
          expect(layout.panel).not.toBeNull();
          expect(layout.tabs).toBeNull();
          expect(layout.content).toBeNull();
          expect(layout.footer).toBeNull();
        } else {
          expect(layout.rail).toBeNull();
          expect(layout.cards).toBeNull();
          expect(layout.panel).toBeNull();
          expect(layout.tabs).not.toBeNull();
          expect(layout.content).not.toBeNull();
          expect(layout.footer).not.toBeNull();
        }
      });
    });
  }

  test("wide starts at tabletLandscape once WIDE_MIN_WIDTH clears, matching scenes/deck-builder.ts's own threshold for the identical three-column split", () => {
    expect(deckCheckLayout({ width: 440, height: 900 }).wide).toBe(false);
    expect(deckCheckLayout({ width: 768, height: 1024 }).wide).toBe(false);
    // 800×600 is landscape-shaped (width >= height) but under WIDE_MIN_WIDTH (1000): too narrow for two fixed-width
    // rails plus a livable grid, so it stays the narrow, tab-scoped layout rather than overflowing.
    expect(deckCheckLayout({ width: 800, height: 600 }).wide).toBe(false);
    expect(deckCheckLayout({ width: 1024, height: 768 }).wide).toBe(true);
    expect(deckCheckLayout({ width: 1280, height: 900 }).wide).toBe(true);
    expect(deckCheckLayout({ width: 1440, height: 900 }).wide).toBe(true);
    expect(deckCheckLayout({ width: 1870, height: 1050 }).wide).toBe(true);
  });

  test("wide: the whole width is used — no dead margin either side of the three columns", () => {
    for (const { width, height } of VIEWPORTS) {
      const layout = deckCheckLayout({ width, height });
      if (!layout.wide) continue;
      expect(layout.rail!.x).toBe(GUTTER_FOR(width));
      expect(layout.panel!.x + layout.panel!.width).toBeCloseTo(width - GUTTER_FOR(width), 5);
    }
  });

  test("wide: the card grid keeps growing as the viewport widens, rather than the rails or gutters eating the gain", () => {
    const at1024 = deckCheckLayout({ width: 1024, height: 768 });
    const at1870 = deckCheckLayout({ width: 1870, height: 1050 });
    expect(at1870.cards!.width).toBeGreaterThan(at1024.cards!.width);
    expect(at1870.rail!.width).toBe(at1024.rail!.width);
    expect(at1870.panel!.width).toBe(at1024.panel!.width);
  });

  test("narrow: content never has negative height even on a very short viewport", () => {
    const layout = deckCheckLayout({ width: 440, height: 320 });
    expect(layout.content!.height).toBeGreaterThanOrEqual(0);
  });

  test("narrow: tabs and content share the same centered reading-measure column", () => {
    const narrow = deckCheckLayout({ width: 768, height: 1024 });
    expect(narrow.tabs!.width).toBe(narrow.content!.width);
    expect(narrow.tabs!.x).toBe(narrow.content!.x);
  });
});

function GUTTER_FOR(width: number): number {
  return width < 768 ? 16 : 24;
}
