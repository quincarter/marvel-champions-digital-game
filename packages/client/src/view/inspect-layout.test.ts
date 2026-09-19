import { describe, expect, test } from "vitest";
import { rectsOverlap } from "./layout.js";
import { cardFaceLayout, inspectLayout, inspectLayoutRects } from "./inspect-layout.js";

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

  test("panel widths cap at D08's own 400/440 on a wide desktop, rather than stretching", () => {
    const layout = inspectLayout({ x: 0, y: 0, width: 1870, height: 1050 });
    if (layout.mode !== "panels") throw new Error("expected panels mode");
    expect(layout.card.width).toBeLessThanOrEqual(400);
    expect(layout.rules.width).toBeLessThanOrEqual(440);
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
    expect(layout.footerPrimaryRow.y + layout.footerPrimaryRow.height).toBeLessThanOrEqual(layout.footerQuietRow.y + 0.01);
  });

  test("'Full rules text' expands the sheet to the full viewport height", () => {
    const collapsed = inspectLayout({ x: 0, y: 0, width: 390, height: 844 });
    const expanded = inspectLayout({ x: 0, y: 0, width: 390, height: 844 }, { expanded: true });
    if (collapsed.mode !== "sheet" || expanded.mode !== "sheet") throw new Error("expected sheet mode");
    expect(expanded.sheet.height).toBeGreaterThan(collapsed.sheet.height);
    expect(expanded.sheet.height).toBe(844);
  });
});

describe("cardFaceLayout", () => {
  const rect = { x: 0, y: 0, width: 400, height: 660 };

  test("a short card keeps a big picture: art is at least about half the panel", () => {
    const layout = cardFaceLayout(rect, { rulesTextLines: 2, hasStats: false, hasIcons: false });
    expect(layout.art).not.toBeNull();
    expect(layout.art!.height).toBeGreaterThan((rect.height - 90) * 0.4);
  });

  test("a very long rules text still leaves a positive scroll region and a positive (if smaller) art region — nothing collapses to zero or goes negative", () => {
    const layout = cardFaceLayout(rect, { rulesTextLines: 40, hasStats: true, hasIcons: true });
    expect(layout.scroll.height).toBeGreaterThan(0);
    expect(layout.scroll.width).toBeGreaterThan(0);
    if (layout.art) expect(layout.art.height).toBeGreaterThan(0);
    expect(layout.stats).not.toBeNull();
    expect(layout.icons).not.toBeNull();
  });

  test("stats and icons rows never overlap the scroll region or the footer", () => {
    const layout = cardFaceLayout(rect, { rulesTextLines: 12, hasStats: true, hasIcons: true });
    if (layout.stats) expect(rectsOverlap(layout.stats, layout.scroll)).toBe(false);
    if (layout.icons) expect(rectsOverlap(layout.icons, layout.scroll)).toBe(false);
    expect(rectsOverlap(layout.scroll, layout.footer)).toBe(false);
  });

  test("a tiny panel degrades to no art rather than a negative-height rect", () => {
    const layout = cardFaceLayout({ x: 0, y: 0, width: 200, height: 100 }, { rulesTextLines: 20, hasStats: false, hasIcons: false });
    if (layout.art) expect(layout.art.height).toBeGreaterThan(0);
    expect(layout.scroll.height).toBeGreaterThanOrEqual(0);
  });
});
