import { describe, expect, test } from "vitest";
import { useEnglish, useSpanish } from "../i18n/test-language.js";
import { CARDS_BY_ID, POOL_ENCOUNTER_SETS, POOL_SCENARIOS } from "../content/pool.js";
import { scenarioDetailOf } from "../view/scenario-detail.js";
import { scenarioSelectLayout } from "../view/scenario-select-layout.js";
import { statCellsOf } from "./scenario-panels.js";

const rhino = POOL_SCENARIOS.find((s) => (s.id as string) === "rhino")!;

describe("statCellsOf", () => {
  test("reads the four cells of the strip off the scenario detail, in English", () => {
    useEnglish();
    const cells = statCellsOf(scenarioDetailOf(rhino, CARDS_BY_ID, POOL_ENCOUNTER_SETS, "en"));
    expect(cells.map((cell) => cell.label)).toEqual(["Main scheme", "Starting threat", "Villain HP", "Encounter sets"]);
    expect(cells[0]!.value.length).toBeGreaterThan(0);
    // Every stage's HP, as "14 · 15 · 16", not only the first stage's.
    expect(cells[2]!.value).toMatch(/\d+ · \d+/);
  });

  test("reads in Spanish through the same keys", () => {
    useSpanish();
    try {
      const cells = statCellsOf(scenarioDetailOf(rhino, CARDS_BY_ID, POOL_ENCOUNTER_SETS, "es"));
      expect(cells[0]!.label).not.toBe("Main scheme");
      expect(cells).toHaveLength(4);
    } finally {
      useEnglish();
    }
  });
});

describe("the layout under the screen's own top bar", () => {
  test("starts its body a gutter under a header of the height the screen passes", () => {
    const base = { width: 1440, height: 900, chipRows: 1, detailLines: 12 } as const;
    const tall = scenarioSelectLayout({ ...base, headerHeight: 60 });
    const plain = scenarioSelectLayout(base);
    expect(tall.headerBar.height).toBe(60);
    expect(plain.headerBar.height).toBe(64);
    expect(plain.search.y - tall.search.y).toBe(4);
  });
});
