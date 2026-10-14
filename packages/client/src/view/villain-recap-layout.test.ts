import { describe, expect, test } from "vitest";
import type { FormFactor, Rect } from "./layout.js";
import { formFactorFor, rectsOverlap } from "./layout.js";
import { villainRecapLayout, type VillainRecapLayout } from "./villain-recap-layout.js";

const VIEWPORTS = [
  { name: "phone 390x844", width: 390, height: 844 },
  { name: "tablet portrait 768x1024", width: 768, height: 1024 },
  { name: "tablet landscape 1024x768", width: 1024, height: 768 },
  { name: "desktop 1440x900", width: 1440, height: 900 },
];

function leafRects(layout: VillainRecapLayout): readonly Rect[] {
  return [layout.title, layout.hide, layout.fullLog, ...layout.tiles, ...layout.regions, layout.toggle, layout.cta];
}

describe("villainRecapLayout", () => {
  for (const { name, width, height } of VIEWPORTS) {
    const formFactor: FormFactor = formFactorFor(width, height);
    const bounds: Rect = { x: 0, y: 0, width, height };
    for (const tileCount of [3, 5, 8]) {
      describe(`${name}, ${tileCount} tiles`, () => {
        const layout = villainRecapLayout(bounds, formFactor, tileCount);

        test("nothing overlaps", () => {
          const rects = leafRects(layout).filter((r) => r.width > 0 && r.height > 0);
          for (let i = 0; i < rects.length; i++) {
            for (let j = i + 1; j < rects.length; j++) {
              expect(rectsOverlap(rects[i]!, rects[j]!), `rect ${i} overlaps rect ${j}`).toBe(false);
            }
          }
        });

        test("everything is on screen", () => {
          for (const rect of [...leafRects(layout), layout.hint, layout.subtitle]) {
            expect(rect.x).toBeGreaterThanOrEqual(0);
            expect(rect.y).toBeGreaterThanOrEqual(0);
            expect(rect.x + rect.width).toBeLessThanOrEqual(width + 0.001);
            expect(rect.y + rect.height).toBeLessThanOrEqual(height + 0.001);
            expect(rect.width).toBeGreaterThanOrEqual(0);
            expect(rect.height).toBeGreaterThanOrEqual(0);
          }
        });

        test("the call to action is at the foot and big enough to press", () => {
          expect(layout.cta.height).toBeGreaterThanOrEqual(44);
          expect(layout.cta.y + layout.cta.height).toBeGreaterThan(height - 60);
          expect(layout.cta.y + layout.cta.height).toBeLessThanOrEqual(layout.panel.y + layout.panel.height);
        });

        test("every step has a region and every region has room", () => {
          expect(layout.stepRegion).toHaveLength(5);
          for (const index of layout.stepRegion) expect(layout.regions[index]).toBeDefined();
          for (const region of layout.regions) {
            expect(region.height).toBeGreaterThan(150);
            expect(region.width).toBeGreaterThan(150);
          }
        });

        test("one tile per change", () => {
          expect(layout.tiles).toHaveLength(tileCount);
        });
      });
    }
  }
});
