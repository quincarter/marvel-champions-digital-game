import { describe, expect, test } from "vitest";
import { hit } from "../tokens.js";
import { rectsOverlap } from "./layout.js";
import {
  DESKTOP_ART_ASPECT,
  cardFaceContentHeight,
  cardFaceLayout,
  cardMaxWidthFor,
  inspectLayout,
  inspectLayoutRects,
  sheetPlayPayWidths,
  sheetTextColumn,
} from "./inspect-layout.js";

/** docs/phase4-screen-gaps.md's own required sizes for this workstream, plus the reference viewports. */
const SIZES = [
  { name: "desktop (1440×900)", width: 1440, height: 900 },
  { name: "wide desktop (1870×1050)", width: 1870, height: 1050 },
  { name: "tablet landscape (1024×768)", width: 1024, height: 768 },
  { name: "tablet portrait (768×1024)", width: 768, height: 1024 },
  { name: "phone (390×844)", width: 390, height: 844 },
];

describe("inspectLayout", () => {
  for (const { name, width, height } of SIZES) {
    test(`no two interactive rects overlap at ${name}`, () => {
      const layout = inspectLayout({ x: 0, y: 0, width, height });
      const rects = inspectLayoutRects(layout);
      for (let i = 0; i < rects.length; i++) {
        for (let j = i + 1; j < rects.length; j++) {
          expect(rectsOverlap(rects[i]!, rects[j]!), `rect ${i} overlaps rect ${j}`).toBe(false);
        }
      }
    });

    test(`every rect stays inside the viewport at ${name}`, () => {
      const layout = inspectLayout({ x: 0, y: 0, width, height });
      for (const rect of inspectLayoutRects(layout)) {
        expect(rect.x).toBeGreaterThanOrEqual(0);
        expect(rect.y).toBeGreaterThanOrEqual(0);
        expect(rect.x + rect.width).toBeLessThanOrEqual(width + 0.01);
        expect(rect.y + rect.height).toBeLessThanOrEqual(height + 0.01);
        expect(rect.width).toBeGreaterThan(0);
        expect(rect.height).toBeGreaterThan(0);
      }
    });
  }

  test("panels mode for every non-phone size, sheet mode only for phone (owner feedback 2026-09-18: tablet should read like D08)", () => {
    for (const { name, width, height } of SIZES) {
      const layout = inspectLayout({ x: 0, y: 0, width, height });
      if (width < 768) expect(layout.mode, name).toBe("sheet");
      else expect(layout.mode, name).toBe("panels");
    }
  });

  test("the card and rules panels are the same height, matching D08's equal-height pair", () => {
    for (const { width, height } of SIZES.filter((s) => s.width >= 768)) {
      const layout = inspectLayout({ x: 0, y: 0, width, height });
      if (layout.mode !== "panels") throw new Error("expected panels mode");
      expect(layout.card.height).toBeCloseTo(layout.rules.height, 5);
    }
  });

  test("panel widths cap rather than stretching on a wide desktop: the rules panel at D08's 440, the card panel at 400 on a D08-height window and up to 520 on a tall one (2026-09-21: the card was too small to read on a big monitor)", () => {
    const short = inspectLayout({ x: 0, y: 0, width: 2000, height: 760 });
    if (short.mode !== "panels") throw new Error("expected panels mode");
    expect(short.card.width).toBeLessThanOrEqual(400);
    expect(short.rules.width).toBeLessThanOrEqual(440);
    const tall = inspectLayout({ x: 0, y: 0, width: 1870, height: 1050 });
    if (tall.mode !== "panels") throw new Error("expected panels mode");
    expect(tall.card.width).toBeGreaterThan(400);
    expect(tall.card.width).toBeLessThanOrEqual(520);
    expect(tall.rules.width).toBeLessThanOrEqual(440);
    expect(cardMaxWidthFor(900)).toBe(450);
  });

  test("a desktop art band (`artAspect`) is taller than D08's, and the card face still gives the text its full natural height at that content height", () => {
    const content = {
      bodySize: 14,
      rulesTextLines: 4,
      printedTextLines: 0,
      flavorLines: 2,
      hasStats: true,
      hasIcons: true,
    };
    const base = cardFaceContentHeight(450, content);
    const tallArt = cardFaceContentHeight(450, { ...content, artAspect: DESKTOP_ART_ASPECT });
    expect(tallArt - base).toBe(Math.round(450 * DESKTOP_ART_ASPECT) - Math.round(450 * (250 / 400)));
    const face = cardFaceLayout(
      { x: 0, y: 0, width: 450, height: tallArt },
      { ...content, artAspect: DESKTOP_ART_ASPECT },
    );
    expect(face.art!.height).toBe(Math.round(450 * DESKTOP_ART_ASPECT));
    // ...and on a shorter panel the art is what gives way, never the text.
    const clamped = cardFaceLayout(
      { x: 0, y: 0, width: 450, height: base },
      { ...content, artAspect: DESKTOP_ART_ASPECT },
    );
    expect(clamped.art!.height).toBeLessThan(face.art!.height);
    expect(clamped.scroll.height).toBeCloseTo(face.scroll.height, 0);
  });

  test("panels shrink together, never overlapping, on a narrower tablet", () => {
    const layout = inspectLayout({ x: 0, y: 0, width: 768, height: 1024 });
    if (layout.mode !== "panels") throw new Error("expected panels mode");
    expect(layout.card.x + layout.card.width).toBeLessThanOrEqual(layout.rules.x);
    expect(layout.card.width).toBeGreaterThan(200);
    expect(layout.rules.width).toBeGreaterThan(200);
  });

  test("phone sheet mode: content sits between the handle and the sticky footer, never under either", () => {
    const layout = inspectLayout({ x: 0, y: 0, width: 390, height: 844 });
    if (layout.mode !== "sheet") throw new Error("expected sheet mode");
    expect(layout.content.y).toBeGreaterThanOrEqual(layout.handle.y + layout.handle.height);
    expect(layout.content.y + layout.content.height).toBeLessThanOrEqual(layout.footer.y + 0.01);
    expect(layout.footerPrimaryRow.y + layout.footerPrimaryRow.height).toBeLessThanOrEqual(
      layout.footerQuietRow.y + 0.01,
    );
  });

  test("the sheet's own footer rows meet the app's touch-target floor (hit.primary / hit.target)", () => {
    const layout = inspectLayout({ x: 0, y: 0, width: 390, height: 844 });
    if (layout.mode !== "sheet") throw new Error("expected sheet mode");
    expect(layout.footerPrimaryRow.height).toBeGreaterThanOrEqual(hit.primary);
    expect(layout.footerQuietRow.height).toBeGreaterThanOrEqual(hit.target);
  });

  test("'Full rules text' expands the sheet to the full viewport height", () => {
    const collapsed = inspectLayout({ x: 0, y: 0, width: 390, height: 844 });
    const expanded = inspectLayout({ x: 0, y: 0, width: 390, height: 844 }, { expanded: true });
    if (collapsed.mode !== "sheet" || expanded.mode !== "sheet") throw new Error("expected sheet mode");
    expect(expanded.sheet.height).toBeGreaterThan(collapsed.sheet.height);
    expect(expanded.sheet.height).toBe(844);
  });

  test("the collapsed sheet hugs its measured content, between half the viewport and the 78% ceiling", () => {
    const viewport = { x: 0, y: 0, width: 390, height: 844 };
    const heightFor = (sheetContentHeight: number): number => {
      const layout = inspectLayout(viewport, { sheetContentHeight });
      if (layout.mode !== "sheet") throw new Error("expected sheet mode");
      // Whatever the height, the sheet stays docked to the bottom edge and the body fills what the footer leaves.
      expect(layout.sheet.y + layout.sheet.height).toBe(844);
      expect(layout.content.y + layout.content.height).toBe(layout.footer.y);
      return layout.sheet.height;
    };
    const short = heightFor(100);
    const medium = heightFor(340);
    const long = heightFor(2000);
    expect(short).toBe(Math.round(844 * 0.5));
    expect(medium).toBeGreaterThan(short);
    expect(medium).toBeLessThan(long);
    expect(long).toBe(Math.round(844 * 0.78));
    // A body that fits is shown whole: no scrolling for content the sheet had room for.
    const fitted = inspectLayout(viewport, { sheetContentHeight: 340 });
    if (fitted.mode !== "sheet") throw new Error("expected sheet mode");
    expect(fitted.content.height).toBeGreaterThanOrEqual(340);
  });

  // "The pair is content-sized, not viewport-stretched" — owner feedback 2026-09-21: the previous build stretched
  // both panels to nearly the viewport height, leaving the ink panel mostly empty with a bare scrollbar in it.
  test("a short card and a short rules panel give a short pair, not a viewport-stretched one", () => {
    const layout = inspectLayout(
      { x: 0, y: 0, width: 1440, height: 980 },
      { cardContentHeight: 360, rulesContentHeight: 340 },
    );
    if (layout.mode !== "panels") throw new Error("expected panels mode");
    expect(layout.card.height).toBeCloseTo(360, 5);
    expect(layout.rules.height).toBeCloseTo(360, 5);
    expect(layout.card.height).toBeLessThan(980 * 0.6);
  });

  test("the pair's height is the taller of the two panels' own content heights", () => {
    const layout = inspectLayout(
      { x: 0, y: 0, width: 1440, height: 980 },
      { cardContentHeight: 500, rulesContentHeight: 620 },
    );
    if (layout.mode !== "panels") throw new Error("expected panels mode");
    expect(layout.card.height).toBeCloseTo(620, 5);
    expect(layout.rules.height).toBeCloseTo(620, 5);
  });

  test("a very long card or rules panel caps at the viewport rather than overflowing it", () => {
    const layout = inspectLayout(
      { x: 0, y: 0, width: 1440, height: 980 },
      { cardContentHeight: 4000, rulesContentHeight: 500 },
    );
    if (layout.mode !== "panels") throw new Error("expected panels mode");
    expect(layout.card.y).toBeGreaterThanOrEqual(0);
    expect(layout.card.y + layout.card.height).toBeLessThanOrEqual(980);
  });

  test("the pair is vertically centered in the viewport", () => {
    const layout = inspectLayout(
      { x: 0, y: 0, width: 1440, height: 980 },
      { cardContentHeight: 400, rulesContentHeight: 400 },
    );
    if (layout.mode !== "panels") throw new Error("expected panels mode");
    const spaceAbove = layout.card.y;
    const spaceBelow = 980 - layout.hint.height - (layout.card.y + layout.card.height);
    expect(spaceAbove).toBeCloseTo(spaceBelow, 1);
  });
});

describe("cardFaceLayout", () => {
  const rect = { x: 0, y: 0, width: 400, height: 660 };
  const short = {
    bodySize: 14,
    rulesTextLines: 2,
    printedTextLines: 0,
    flavorLines: 0,
    hasStats: false,
    hasIcons: false,
  };
  const long = {
    bodySize: 14,
    rulesTextLines: 40,
    printedTextLines: 0,
    flavorLines: 0,
    hasStats: true,
    hasIcons: true,
  };

  test("a card at its own natural height (cardFaceLayout given exactly cardFaceContentHeight) fits its art at D08's own 250/400 aspect, no clamp involved", () => {
    const natural = cardFaceContentHeight(rect.width, short);
    const layout = cardFaceLayout({ ...rect, height: natural }, short);
    expect(layout.art).not.toBeNull();
    expect(layout.art!.height).toBeCloseTo(Math.round(rect.width * (250 / 400)), 0);
  });

  test("a very long rules text still leaves a positive scroll region and a positive (if smaller) art region — nothing collapses to zero or goes negative", () => {
    const layout = cardFaceLayout(rect, long);
    expect(layout.scroll.height).toBeGreaterThan(0);
    expect(layout.scroll.width).toBeGreaterThan(0);
    if (layout.art) expect(layout.art.height).toBeGreaterThan(0);
    expect(layout.stats).not.toBeNull();
  });

  test("stats never overlaps the scroll region or the footer", () => {
    const layout = cardFaceLayout(rect, { ...long, rulesTextLines: 12 });
    if (layout.stats) expect(rectsOverlap(layout.stats, layout.scroll)).toBe(false);
    expect(rectsOverlap(layout.scroll, layout.footer)).toBe(false);
  });

  test("a tiny panel degrades to no art rather than a negative-height rect", () => {
    const layout = cardFaceLayout({ x: 0, y: 0, width: 200, height: 100 }, { ...short, rulesTextLines: 20 });
    if (layout.art) expect(layout.art.height).toBeGreaterThan(0);
    expect(layout.scroll.height).toBeGreaterThanOrEqual(0);
  });

  test("a panel taller than the card's own natural height leaves the extra room as blank space above a footer still pinned to the very bottom", () => {
    const natural = cardFaceContentHeight(rect.width, short);
    const layout = cardFaceLayout({ ...rect, height: natural + 120 }, short);
    expect(layout.footer.y + layout.footer.height).toBeCloseTo(natural + 120, 0);
    expect(layout.scroll.height).toBeGreaterThan(0);
  });
});

describe("cardFaceContentHeight", () => {
  const short = {
    bodySize: 14,
    rulesTextLines: 2,
    printedTextLines: 0,
    flavorLines: 0,
    hasStats: false,
    hasIcons: false,
  };
  const long = {
    bodySize: 14,
    rulesTextLines: 12,
    printedTextLines: 4,
    flavorLines: 2,
    hasStats: true,
    hasIcons: true,
  };

  test("more text, printed-text, flavor, stats and pips all add height", () => {
    expect(cardFaceContentHeight(400, long)).toBeGreaterThan(cardFaceContentHeight(400, short));
  });

  test("a wider panel gets a taller art band, and a taller natural height with it", () => {
    expect(cardFaceContentHeight(500, short)).toBeGreaterThan(cardFaceContentHeight(400, short));
  });

  test("large card text (17px) makes the same line count taller", () => {
    expect(cardFaceContentHeight(400, { ...short, bodySize: 17 })).toBeGreaterThan(cardFaceContentHeight(400, short));
  });
});

describe("sheetTextColumn", () => {
  test("the text column starts past the 116px thumbnail and its gap, and never goes negative", () => {
    const column = sheetTextColumn(390);
    expect(column.x).toBe(14 + 116 + 11);
    expect(column.width).toBeGreaterThan(0);
    expect(column.x + column.width).toBeLessThanOrEqual(390 - 14 + 0.01);
  });

  test("degrades to a 1px-minimum column rather than a negative width on an absurdly narrow sheet", () => {
    const column = sheetTextColumn(100);
    expect(column.width).toBeGreaterThanOrEqual(1);
  });
});

describe("sheetPlayPayWidths", () => {
  test("splits at P14's own 1.4:1 ratio and accounts for the gap between them", () => {
    const { play, pay } = sheetPlayPayWidths(362, 6);
    expect(play + pay + 6).toBeCloseTo(362, 5);
    expect(play / pay).toBeCloseTo(1.4, 5);
    expect(play).toBeGreaterThan(pay);
  });

  test("never goes negative on a row narrower than the gap", () => {
    const { play, pay } = sheetPlayPayWidths(4, 6);
    expect(play).toBeGreaterThanOrEqual(0);
    expect(pay).toBeGreaterThanOrEqual(0);
  });
});
