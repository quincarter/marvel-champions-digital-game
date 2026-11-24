import { describe, expect, test } from "vitest";
import { REFERENCE_VIEWPORTS, rectsOverlap } from "./layout.js";
import { MIN_ROW_TILE_WIDTH, SCROLLBAR_ROOM, targetingLayout } from "./targeting-layout.js";

const SIZES = [
  { name: "phone", ...REFERENCE_VIEWPORTS.phone },
  { name: "tablet portrait", ...REFERENCE_VIEWPORTS.tabletPortrait },
  { name: "tablet landscape", ...REFERENCE_VIEWPORTS.tabletLandscape },
  { name: "desktop", ...REFERENCE_VIEWPORTS.desktop },
];

describe("targetingLayout", () => {
  for (const { name, width, height } of SIZES) {
    for (const targetCount of [1, 3, 6]) {
      test(`no two regions overlap at ${name} (${width}x${height}), ${targetCount} targets`, () => {
        const layout = targetingLayout({ x: 0, y: 0, width, height }, targetCount);
        const rects = [
          layout.titleBar,
          layout.heading,
          layout.targets,
          layout.excluded,
          ...(layout.inspectorRail ? [layout.inspectorRail] : []),
        ];
        for (let i = 0; i < rects.length; i++) {
          for (let j = i + 1; j < rects.length; j++) {
            expect(rectsOverlap(rects[i]!, rects[j]!), `region ${i} overlaps region ${j}`).toBe(false);
          }
        }
        // Cancel lives inside the title bar, not floating outside it.
        expect(layout.cancelButton.x).toBeGreaterThanOrEqual(layout.titleBar.x);
        expect(layout.cancelButton.x + layout.cancelButton.width).toBeLessThanOrEqual(
          layout.titleBar.x + layout.titleBar.width + 0.001,
        );
        expect(layout.cancelButton.y).toBeGreaterThanOrEqual(layout.titleBar.y);
        expect(layout.cancelButton.y + layout.cancelButton.height).toBeLessThanOrEqual(
          layout.titleBar.y + layout.titleBar.height + 0.001,
        );
      });
    }

    test(`every region stays within the viewport at ${name}`, () => {
      const layout = targetingLayout({ x: 0, y: 0, width, height }, 3);
      for (const rect of [
        layout.titleBar,
        layout.heading,
        layout.targets,
        layout.excluded,
        ...(layout.inspectorRail ? [layout.inspectorRail] : []),
      ]) {
        expect(rect.x).toBeGreaterThanOrEqual(0);
        expect(rect.y).toBeGreaterThanOrEqual(0);
        expect(rect.x + rect.width).toBeLessThanOrEqual(width + 0.001);
        expect(rect.y + rect.height).toBeLessThanOrEqual(height + 0.001);
      }
    });
  }

  test("the inspector rail exists only at tablet landscape (L06) — desktop keeps the 'why not' column instead", () => {
    expect(targetingLayout({ x: 0, y: 0, ...REFERENCE_VIEWPORTS.tabletLandscape }, 3).inspectorRail).not.toBeNull();
    expect(targetingLayout({ x: 0, y: 0, ...REFERENCE_VIEWPORTS.desktop }, 3).inspectorRail).toBeNull();
    expect(targetingLayout({ x: 0, y: 0, ...REFERENCE_VIEWPORTS.phone }, 3).inspectorRail).toBeNull();
    expect(targetingLayout({ x: 0, y: 0, ...REFERENCE_VIEWPORTS.tabletPortrait }, 3).inspectorRail).toBeNull();
  });

  test("the 'why not' region never collapses to zero size — there is always somewhere to say nothing was excluded", () => {
    for (const { width, height } of SIZES) {
      const layout = targetingLayout({ x: 0, y: 0, width, height }, 3);
      expect(layout.excluded.width).toBeGreaterThan(0);
      expect(layout.excluded.height).toBeGreaterThan(0);
    }
  });

  test("zero targets still yields a sane (zero-area) tile size rather than dividing by zero", () => {
    const layout = targetingLayout({ x: 0, y: 0, ...REFERENCE_VIEWPORTS.desktop }, 0);
    expect(layout.tileSize.width).toBe(0);
    expect(layout.tileSize.height).toBe(0);
    expect(Number.isFinite(layout.tileSize.width)).toBe(true);
  });

  test("a wide layout's tile keeps the card aspect ratio; a narrow layout's tile is a full-width row instead", () => {
    const desktop = targetingLayout({ x: 0, y: 0, ...REFERENCE_VIEWPORTS.desktop }, 3);
    expect(desktop.tileSize.height).toBeCloseTo(desktop.tileSize.width / (2.5 / 3.5), 1);
    const phone = targetingLayout({ x: 0, y: 0, ...REFERENCE_VIEWPORTS.phone }, 3);
    expect(phone.tileSize.width).toBeCloseTo(phone.targets.width, 1);
  });

  test("desktop: 'why not the others?' sits under the target row, so it never covers the lit board beside it", () => {
    const layout = targetingLayout({ x: 0, y: 0, ...REFERENCE_VIEWPORTS.desktop }, 3);
    expect(layout.excluded.y).toBeGreaterThanOrEqual(layout.tileSize.y + layout.tileSize.height);
    // The row keeps the whole width: the right-hand column (where a second villain sits) is clear of the panel.
    expect(layout.excluded.x + layout.excluded.width).toBeLessThan(REFERENCE_VIEWPORTS.desktop.width * 0.5);
  });

  test("tiles size to their measured text: a few words make a short tile, not a whole card", () => {
    const bounds = { x: 0, y: 0, ...REFERENCE_VIEWPORTS.desktop };
    const card = targetingLayout(bounds, 2);
    const fitted = targetingLayout(bounds, 2, { textHeight: 40, confirmReserve: 30 });
    expect(fitted.tileSize.height).toBeLessThan(card.tileSize.height);
    expect(fitted.tileSize.height).toBeGreaterThanOrEqual(fitted.artHeight + 40);
  });

  test("phone: a row is as tall as its text, the art goes first when rows run short, and the bar holds a wrapped title", () => {
    const bounds = { x: 0, y: 0, ...REFERENCE_VIEWPORTS.phone };
    const roomy = targetingLayout(bounds, 2, { textHeight: 60, confirmReserve: 30 });
    expect(roomy.tileSize.height).toBe(60 + 30 + 16 + 6 + roomy.artHeight);
    // Four rows fit without their art: they drop it and stay on screen whole.
    const crowded = targetingLayout(bounds, 4, { textHeight: 60, confirmReserve: 0 });
    expect(crowded.artHeight).toBe(0);
    expect(crowded.scrolls).toBe(false);
    expect(roomy.titleBar.height).toBeGreaterThanOrEqual(60);
  });

  // Reported from an iPhone: Repurpose listed every Tech upgrade in one column that ran off the bottom of the screen.
  const SE = { x: 0, y: 0, width: 375, height: 667 };
  const TEXT = { textHeight: 22, confirmReserve: 0 };

  test("iPhone SE: seven cards to pick scroll in the list, keep their art, and none is drawn outside it", () => {
    const layout = targetingLayout(SE, 7, TEXT, 64, true);
    expect(layout.scrolls).toBe(true);
    expect(layout.artHeight).toBeGreaterThan(0);
    expect(layout.tiles).toHaveLength(7);
    for (const tile of layout.tiles) {
      expect(tile.x).toBeGreaterThanOrEqual(layout.targets.x);
      // The scrollbar keeps its strip on the right.
      expect(tile.x + tile.width).toBeLessThanOrEqual(layout.targets.x + layout.targets.width - SCROLLBAR_ROOM + 0.001);
    }
    // The scroll covers every row: the last tile's bottom is the content's bottom.
    const total = layout.lineHeights.reduce((sum, height) => sum + height, 0);
    const last = layout.tiles[6]!;
    expect(last.y + last.height - layout.targets.y).toBeCloseTo(total, 3);
    expect(total).toBeGreaterThan(layout.targets.height);
    expect(layout.lineOf).toEqual([0, 1, 2, 3, 4, 5, 6]);
  });

  test("a few cards still fit without scrolling, at every size", () => {
    for (const { name, width, height } of [...SIZES, { name: "se", width: 375, height: 667 }]) {
      const layout = targetingLayout({ x: 0, y: 0, width, height }, 3, TEXT, 40, true);
      expect(layout.scrolls, name).toBe(false);
      for (const tile of layout.tiles) expect(tile.y + tile.height, name).toBeLessThanOrEqual(height);
    }
  });

  test("a pick with no 'why not' box gives its tiles that room", () => {
    const bounds = { x: 0, y: 0, ...REFERENCE_VIEWPORTS.phone };
    const boxed = targetingLayout(bounds, 3, TEXT, 64);
    const open = targetingLayout(bounds, 3, TEXT, 64, true);
    expect(open.targets.height).toBeGreaterThan(boxed.targets.height);
    expect(open.targets.y + open.targets.height).toBeLessThanOrEqual(bounds.height);
  });

  test("desktop and tablet landscape: a long row wraps onto more rows of readable tiles, and scrolls past its area", () => {
    for (const viewport of [REFERENCE_VIEWPORTS.desktop, REFERENCE_VIEWPORTS.tabletLandscape]) {
      const bounds = { x: 0, y: 0, ...viewport };
      const layout = targetingLayout(bounds, 16, TEXT, 44, true);
      expect(layout.tiles[0]!.width).toBeGreaterThanOrEqual(MIN_ROW_TILE_WIDTH - SCROLLBAR_ROOM);
      expect(layout.tileSize.width).toBe(layout.tiles[0]!.width);
      expect(layout.lineHeights.length).toBeGreaterThan(1);
      for (const tile of layout.tiles) {
        expect(tile.x + tile.width).toBeLessThanOrEqual(layout.targets.x + layout.targets.width + 0.001);
      }
      // Tiles on one row share its top; the next row starts under it.
      const [a, b] = [layout.tiles[0]!, layout.tiles[layout.tiles.findIndex((_, i) => layout.lineOf[i] === 1)]!];
      expect(b.y).toBeGreaterThan(a.y + a.height);
      const total = layout.lineHeights.reduce((sum, height) => sum + height, 0);
      expect(layout.scrolls).toBe(total > layout.targets.height);
      // With the why-not box the rows stop above it, and scroll there.
      const boxed = targetingLayout(bounds, 40, TEXT, 44);
      expect(boxed.scrolls).toBe(true);
      expect(boxed.targets.y + boxed.targets.height).toBeLessThanOrEqual(boxed.excluded.y);
    }
  });

  test("a row that fits keeps every tile on one line, as before", () => {
    const layout = targetingLayout({ x: 0, y: 0, ...REFERENCE_VIEWPORTS.desktop }, 3, TEXT);
    expect(layout.scrolls).toBe(false);
    expect(new Set(layout.tiles.map((tile) => tile.y)).size).toBe(1);
    expect(layout.lineOf).toEqual([0, 0, 0]);
  });

  test("starts below the table's top bar, where the chrome buttons stay drawn (#515)", () => {
    for (const { name, width, height } of SIZES) {
      const flush = targetingLayout({ x: 0, y: 0, width, height }, 3);
      const below = targetingLayout({ x: 0, y: 0, width, height }, 3, undefined, 36);
      expect(below.formFactor, name).toBe(flush.formFactor);
      expect(below.titleBar.y, name).toBe(36);
      expect(below.targets.y, name).toBeGreaterThan(flush.targets.y);
      expect(below.targets.y + below.targets.height, name).toBeLessThanOrEqual(height);
    }
  });
});
