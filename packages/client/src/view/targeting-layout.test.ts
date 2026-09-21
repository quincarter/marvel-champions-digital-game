import { describe, expect, test } from "vitest";
import { REFERENCE_VIEWPORTS, rectsOverlap } from "./layout.js";
import { targetingLayout } from "./targeting-layout.js";

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
});
