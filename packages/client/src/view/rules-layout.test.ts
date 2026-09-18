import { describe, expect, test } from "vitest";
import { rectsOverlap } from "./layout.js";
import { rulesLayout, type RulesTab } from "./rules-layout.js";

const SIZES = [
  { name: "phone (390×844)", width: 390, height: 844 },
  { name: "phone (legacy)", width: 440, height: 900 },
  { name: "small desktop", width: 800, height: 600 },
  { name: "tablet portrait (820×980)", width: 820, height: 980 },
  { name: "tablet landscape (1024×768)", width: 1024, height: 768 },
  { name: "desktop (1440×900)", width: 1440, height: 900 },
  { name: "desktop (legacy)", width: 1440, height: 980 },
];
const TABS: readonly RulesTab[] = ["glossary", "villainPhase", "cardList"];

describe("rulesLayout", () => {
  for (const { name, width, height } of SIZES) {
    for (const tab of TABS) {
      test(`chrome, tabs, search and body never overlap at ${name} (${tab})`, () => {
        const layout = rulesLayout({ x: 0, y: 0, width, height }, tab);
        const rects = [layout.chrome, layout.tabs, layout.body];
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

  test("the header and scope rows inside the chrome never overlap each other", () => {
    const layout = rulesLayout({ x: 0, y: 0, width: 1440, height: 900 }, "glossary");
    expect(rectsOverlap(layout.header, layout.scope)).toBe(false);
  });

  test("the chrome spans the full width, edge to edge, at every size", () => {
    for (const { width, height } of SIZES) {
      const layout = rulesLayout({ x: 0, y: 0, width, height }, "glossary");
      expect(layout.chrome.x).toBe(0);
      expect(layout.chrome.width).toBe(width);
    }
  });

  test("the body and tabs sit with a margin inside the viewport, not edge to edge", () => {
    const layout = rulesLayout({ x: 0, y: 0, width: 1440, height: 900 }, "glossary");
    expect(layout.body.x).toBeGreaterThan(0);
    expect(layout.body.x + layout.body.width).toBeLessThan(1440);
  });

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
