import { describe, expect, test } from "vitest";
import { LIST_HEIGHT, rectsOverlap, titleLayout, titleLayoutRects, type TitleLayoutInput } from "./title-layout.js";

/** docs/phase4-screen-gaps.md §2 S8: "Checked at portrait phone (about 440×900), 800×600 and desktop sizes." */
const VIEWPORTS = [
  { name: "portrait phone", width: 440, height: 900 },
  { name: "800×600", width: 800, height: 600 },
  { name: "desktop", width: 1440, height: 900 },
];

const BASE: Omit<TitleLayoutInput, "width" | "height"> = { continuable: false, showVillainVersions: false };

describe("titleLayout", () => {
  for (const { name, width, height } of VIEWPORTS) {
    describe(name, () => {
      for (const continuable of [false, true]) {
        for (const showVillainVersions of [false, true]) {
          test(`no two rects overlap (continuable=${continuable}, villainVersions=${showVillainVersions})`, () => {
            const layout = titleLayout({ width, height, continuable, showVillainVersions });
            const rects = titleLayoutRects(layout);
            for (let i = 0; i < rects.length; i++) {
              for (let j = i + 1; j < rects.length; j++) {
                expect(rectsOverlap(rects[i]!, rects[j]!), `rect ${i} overlaps rect ${j}`).toBe(false);
              }
            }
          });
        }
      }

      test("the scenario and hero list viewports never overlap the controls above or below them", () => {
        const layout = titleLayout({ width, height, ...BASE });
        const above = [layout.scenarioSearch];
        const below = [layout.difficulty, layout.heroSearch];
        for (const rect of [...above, ...below]) {
          expect(rectsOverlap(layout.scenarioList, rect)).toBe(false);
        }
        const heroAbove = [layout.heroSearch];
        const heroBelow = [layout.seed, layout.start];
        for (const rect of [...heroAbove, ...heroBelow]) {
          expect(rectsOverlap(layout.heroList, rect)).toBe(false);
        }
      });

      test("every rect stays within the screen bounds", () => {
        const layout = titleLayout({ width, height, continuable: true, showVillainVersions: true });
        for (const rect of titleLayoutRects(layout)) {
          expect(rect.x).toBeGreaterThanOrEqual(0);
          expect(rect.x + rect.width).toBeLessThanOrEqual(width + 0.001);
        }
      });

      test("the list viewport is a fixed height regardless of how many rows it will hold — not a per-row-count cap", () => {
        const layout = titleLayout({ width, height, ...BASE });
        expect(layout.scenarioList.height).toBe(LIST_HEIGHT);
        expect(layout.heroList.height).toBe(LIST_HEIGHT);
      });
    });
  }
});

describe("rectsOverlap", () => {
  test("true for overlapping rects", () => {
    expect(rectsOverlap({ x: 0, y: 0, width: 10, height: 10 }, { x: 5, y: 5, width: 10, height: 10 })).toBe(true);
  });

  test("false for adjacent (touching-edge) rects", () => {
    expect(rectsOverlap({ x: 0, y: 0, width: 10, height: 10 }, { x: 10, y: 0, width: 10, height: 10 })).toBe(false);
  });

  test("false for disjoint rects", () => {
    expect(rectsOverlap({ x: 0, y: 0, width: 10, height: 10 }, { x: 100, y: 100, width: 10, height: 10 })).toBe(false);
  });
});
