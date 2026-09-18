import { describe, expect, test } from "vitest";
import { rectsOverlap } from "./title-layout.js";
import { rulesLayout, type RulesTab } from "./rules-layout.js";

const SIZES = [
  { name: "phone", width: 440, height: 900 },
  { name: "small desktop", width: 800, height: 600 },
  { name: "desktop", width: 1440, height: 980 },
];
const TABS: readonly RulesTab[] = ["glossary", "villainPhase", "cardList"];

describe("rulesLayout", () => {
  for (const { name, width, height } of SIZES) {
    for (const tab of TABS) {
      test(`header, tabs, search and body never overlap at ${name} (${tab})`, () => {
        const layout = rulesLayout({ x: 0, y: 0, width, height }, tab);
        const rects = [layout.header, layout.tabs, layout.body];
        for (let i = 0; i < rects.length; i++) {
          for (let j = i + 1; j < rects.length; j++) {
            expect(rectsOverlap(rects[i]!, rects[j]!)).toBe(false);
          }
        }
        if (layout.search.height > 0) {
          expect(rectsOverlap(layout.search, layout.tabs)).toBe(false);
          expect(rectsOverlap(layout.search, layout.body)).toBe(false);
        }
      });
    }
  }

  test("the search row has zero height outside the glossary tab", () => {
    expect(rulesLayout({ x: 0, y: 0, width: 800, height: 600 }, "villainPhase").search.height).toBe(0);
    expect(rulesLayout({ x: 0, y: 0, width: 800, height: 600 }, "cardList").search.height).toBe(0);
    expect(rulesLayout({ x: 0, y: 0, width: 800, height: 600 }, "glossary").search.height).toBeGreaterThan(0);
  });

  test("the body never goes negative on a very short screen", () => {
    const layout = rulesLayout({ x: 0, y: 0, width: 440, height: 200 }, "glossary");
    expect(layout.body.height).toBeGreaterThanOrEqual(0);
  });
});
