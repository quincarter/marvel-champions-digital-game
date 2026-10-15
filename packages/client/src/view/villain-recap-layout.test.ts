import { describe, expect, test } from "vitest";
import type { FormFactor, Rect } from "./layout.js";
import { formFactorFor, rectsOverlap } from "./layout.js";
import { villainDockedRecapLayout, villainRecapLayout, type VillainRecapLayout } from "./villain-recap-layout.js";

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

describe("villainDockedRecapLayout", () => {
  const PANELS: readonly { name: string; kind: "rail" | "band"; panel: Rect }[] = [
    { name: "rail 600", kind: "rail", panel: { x: 680, y: 64, width: 600, height: 736 } },
    { name: "rail 760", kind: "rail", panel: { x: 680, y: 64, width: 760, height: 836 } },
    { name: "rail 1100", kind: "rail", panel: { x: 1460, y: 64, width: 1100, height: 1376 } },
    { name: "band tall 1024x768", kind: "band", panel: { x: 8, y: 64, width: 1008, height: 470 } },
  ];
  for (const { name, kind, panel } of PANELS) {
    for (const tileCount of [3, 4, 5]) {
      describe(`${name}, ${tileCount} tiles`, () => {
        const layout = villainDockedRecapLayout(panel, kind, tileCount);
        const inside = (r: Rect): boolean =>
          r.x >= panel.x - 0.5 &&
          r.y >= panel.y - 0.5 &&
          r.x + r.width <= panel.x + panel.width + 0.5 &&
          r.y + r.height <= panel.y + panel.height + 0.5;

        test("nothing overlaps and everything is inside the panel", () => {
          const rects = [
            layout.title,
            layout.hide,
            layout.fullLog,
            ...layout.tiles,
            ...layout.regions,
            layout.toggle,
            layout.cta,
          ];
          for (const r of rects) expect(inside(r)).toBe(true);
          const live = rects.filter((r) => r.width > 0 && r.height > 0);
          for (let i = 0; i < live.length; i++) {
            for (let j = i + 1; j < live.length; j++) {
              expect(rectsOverlap(live[i]!, live[j]!), `rect ${i} overlaps rect ${j}`).toBe(false);
            }
          }
        });

        test("steps 1, 3 and 5 stack left, step 2 sits right, step 4 runs across the bottom", () => {
          expect(layout.stepRegion).toEqual([0, 1, 0, 2, 0]);
          const [left, right, lower] = layout.regions as [Rect, Rect, Rect];
          expect(left.x).toBeLessThan(right.x);
          expect(lower.y).toBeGreaterThanOrEqual(left.y + left.height);
          expect(lower.width).toBeGreaterThan(left.width + right.width);
        });

        test("controls are at least 44 tall", () => {
          for (const r of [layout.hide, layout.fullLog, layout.toggle, layout.cta]) {
            expect(r.height).toBeGreaterThanOrEqual(44);
          }
        });
      });
    }
  }
});
