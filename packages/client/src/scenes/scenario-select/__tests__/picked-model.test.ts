import { describe, expect, test } from "vitest";
import { useEnglish, useSpanish } from "../../../i18n/test-language.js";
import { CARDS_BY_ID, POOL_ENCOUNTER_SETS, POOL_SCENARIOS } from "../../../content/pool.js";
import { scenarioDetailOf } from "../../../view/scenario-detail.js";
import { pickedModelOf, statCellsOf } from "../picked-model.js";

const rhino = POOL_SCENARIOS.find((s) => (s.id as string) === "rhino")!;
const detailIn = (lang: "en" | "es") => scenarioDetailOf(rhino, CARDS_BY_ID, POOL_ENCOUNTER_SETS, lang);

describe("statCellsOf", () => {
  test("reads the four cells of the strip off the scenario detail, in English", () => {
    useEnglish();
    const cells = statCellsOf(detailIn("en"));
    expect(cells.map((cell) => cell.label)).toEqual(["Main scheme", "Starting threat", "Villain HP", "Encounter sets"]);
    expect(cells[0]!.value.length).toBeGreaterThan(0);
    // Every stage's HP, as "14 · 15 · 16", not only the first stage's.
    expect(cells[2]!.value).toMatch(/\d+ · \d+/);
  });

  test("reads in Spanish through the same keys", () => {
    useSpanish();
    try {
      const cells = statCellsOf(detailIn("es"));
      expect(cells[0]!.label).not.toBe("Main scheme");
      expect(cells).toHaveLength(4);
    } finally {
      useEnglish();
    }
  });
});

describe("pickedModelOf", () => {
  const input = { difficulty: "standard", record: null, stagesOpen: false, collapsible: false } as const;

  test("before a pick it has no stages, record or sets", () => {
    useEnglish();
    const model = pickedModelOf({ ...input, detail: null });
    expect(model.picked).toBe(false);
    expect(model.stages).toEqual([]);
    expect(model.record).toBeNull();
  });

  test("marks the stages the difficulty plays, and a scenario never played reads as unplayed", () => {
    useEnglish();
    const standard = pickedModelOf({ ...input, detail: detailIn("en") });
    const expert = pickedModelOf({ ...input, difficulty: "expert", detail: detailIn("en") });
    expect(standard.stages.some((stage) => stage.current)).toBe(true);
    expect(standard.stages.map((s) => s.current)).not.toEqual(expert.stages.map((s) => s.current));
    expect(standard.record!.tone).toBe("unplayed");
    expect(standard.sets).toHaveLength(2);
  });

  test("a narrow panel carries the stat strip it opens with and a summary for its shut bar", () => {
    useEnglish();
    const model = pickedModelOf({ ...input, collapsible: true, stagesOpen: true, detail: detailIn("en") });
    expect(model.open).toBe(true);
    expect(model.stats).toHaveLength(4);
    expect(model.summary).toContain("RHINO");
  });
});
