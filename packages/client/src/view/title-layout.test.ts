import { describe, expect, test } from "vitest";
import type { Rect } from "./layout.js";
import { LABEL_ROOM, LIST_VISIBLE_ROWS, ROW_HEIGHT, rectsOverlap, titleLayout, titleLayoutRects, type TitleLayoutInput } from "./title-layout.js";

/**
 * docs/phase4-screen-gaps.md §2 S8: "Checked at portrait phone (about
 * 440×900), 800×600 and desktop sizes." 375×812 (PLAN.md's "Wrecker can't be
 * played from Title" repro size) is added on top: the villain-versions row
 * removed for that report pushed Start off-screen there too.
 */
const VIEWPORTS = [
  { name: "375×812", width: 375, height: 812 },
  { name: "portrait phone", width: 440, height: 900 },
  { name: "800×600", width: 800, height: 600 },
  { name: "desktop", width: 1440, height: 900 },
];

const BASE: Omit<TitleLayoutInput, "width" | "height"> = { continuable: false, scenarioChipRows: 1, heroChipRows: 1 };

describe("titleLayout", () => {
  for (const { name, width, height } of VIEWPORTS) {
    describe(name, () => {
      for (const continuable of [false, true]) {
        test(`no two rects overlap (continuable=${continuable})`, () => {
          const layout = titleLayout({ width, height, continuable, scenarioChipRows: 1, heroChipRows: 3 });
          const rects = titleLayoutRects(layout);
          for (let i = 0; i < rects.length; i++) {
            for (let j = i + 1; j < rects.length; j++) {
              expect(rectsOverlap(rects[i]!, rects[j]!), `rect ${i} overlaps rect ${j}`).toBe(false);
            }
          }
        });
      }

      test("the scenario and hero list viewports never overlap the controls above or below them", () => {
        const layout = titleLayout({ width, height, ...BASE });
        const above = [layout.scenarioSearch, layout.scenarioChips];
        const below = [layout.difficulty, layout.heroSearch];
        for (const rect of [...above, ...below]) {
          expect(rectsOverlap(layout.scenarioList, rect)).toBe(false);
        }
        const heroAbove = [layout.heroSearch, layout.heroChips];
        const heroBelow = [layout.seed, layout.start];
        for (const rect of [...heroAbove, ...heroBelow]) {
          expect(rectsOverlap(layout.heroList, rect)).toBe(false);
        }
      });

      test("the quick-filter chip rows never overlap their own search field or list", () => {
        const layout = titleLayout({ width, height, ...BASE });
        expect(rectsOverlap(layout.scenarioChips, layout.scenarioSearch)).toBe(false);
        expect(rectsOverlap(layout.scenarioChips, layout.scenarioList)).toBe(false);
        expect(rectsOverlap(layout.heroChips, layout.heroSearch)).toBe(false);
        expect(rectsOverlap(layout.heroChips, layout.heroList)).toBe(false);
      });

      test("every rect stays within the screen bounds", () => {
        const layout = titleLayout({ width, height, continuable: true, scenarioChipRows: 1, heroChipRows: 1 });
        for (const rect of titleLayoutRects(layout)) {
          expect(rect.x).toBeGreaterThanOrEqual(0);
          expect(rect.x + rect.width).toBeLessThanOrEqual(width + 0.001);
        }
      });

      test("Start game stays above the fold: the rosters give up whole rows before Start does", () => {
        const layout = titleLayout({ width, height, ...BASE });
        expect(layout.start.y + layout.start.height).toBeLessThanOrEqual(height);
        expect(layout.listRows).toBeGreaterThanOrEqual(1);
        expect(layout.listRows).toBeLessThanOrEqual(LIST_VISIBLE_ROWS);
      });

      test("every labelled control leaves its label room below the control before it", () => {
        const layout = titleLayout({ width, height, continuable: true, scenarioChipRows: 1, heroChipRows: 3 });
        const pairs: readonly [Rect, Rect][] = [
          [layout.scenarioList, layout.difficulty],
          [layout.difficulty, layout.heroSearch],
          [layout.manageDecksRow ?? layout.heroList, layout.seed],
        ];
        for (const [before, labelled] of pairs) {
          expect(labelled.y - LABEL_ROOM).toBeGreaterThanOrEqual(before.y + before.height);
        }
      });

      test("both list viewports are the same whole number of rows, set by the viewport and not by how many rows they hold", () => {
        const layout = titleLayout({ width, height, ...BASE });
        expect(layout.scenarioList.height).toBe(layout.listRows * ROW_HEIGHT);
        expect(layout.heroList.height).toBe(layout.listRows * ROW_HEIGHT);
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
