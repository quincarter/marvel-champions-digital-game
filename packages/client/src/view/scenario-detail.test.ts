import { describe, expect, test } from "vitest";
import { scenarioDetailLines, scenarioDetailOf } from "./scenario-detail.js";
import { CARDS_BY_ID, POOL_ENCOUNTER_SETS, POOL_SCENARIOS } from "../content/pool.js";

const rhino = POOL_SCENARIOS.find((s) => (s.id as string) === "rhino")!;
const breakout = POOL_SCENARIOS.find((s) => (s.id as string) === "breakout")!;

describe("scenarioDetailOf", () => {
  test("a single-villain scenario (Rhino)", () => {
    const detail = scenarioDetailOf(rhino, CARDS_BY_ID, POOL_ENCOUNTER_SETS);
    expect(detail.scenarioName).toBe(rhino.name);
    expect(detail.villainName.length).toBeGreaterThan(0);
    expect(detail.otherVillainNames).toEqual([]);
    expect(detail.mainSchemeName.length).toBeGreaterThan(0);
    expect(detail.stages.length).toBeGreaterThan(0);
    expect(detail.modularSetCount).toBe(1);
    expect(detail.recommendedModularSetNames).toContain("Bomb Scare");
    expect(detail.villainStagesStandard).toEqual([1, 2]);
    expect(detail.villainStagesExpert).toEqual([2, 3]);
  });

  test("stage HP is the printed ScalingValue, unscaled", () => {
    const detail = scenarioDetailOf(rhino, CARDS_BY_ID, POOL_ENCOUNTER_SETS);
    for (const stage of detail.stages) {
      expect(typeof stage.hp.base).toBe("number");
      expect(typeof stage.hp.perPlayer).toBe("number");
    }
  });

  test("a multi-villain scenario (Breakout) names the other villains", () => {
    const detail = scenarioDetailOf(breakout, CARDS_BY_ID, POOL_ENCOUNTER_SETS);
    expect(detail.otherVillainNames.length).toBe(3);
    expect(detail.otherVillainNames).not.toContain(detail.villainName);
  });

  test("Breakout uses no modular sets", () => {
    const detail = scenarioDetailOf(breakout, CARDS_BY_ID, POOL_ENCOUNTER_SETS);
    expect(detail.modularSetCount).toBe(0);
    expect(detail.recommendedModularSetNames).toEqual([]);
  });
});

describe("scenarioDetailLines", () => {
  test("one line per stage, plus the fixed summary lines", () => {
    const detail = scenarioDetailOf(rhino, CARDS_BY_ID, POOL_ENCOUNTER_SETS);
    const lines = scenarioDetailLines(detail);
    expect(lines.length).toBe(5 + detail.stages.length);
    expect(lines[0]).toContain(detail.villainName);
  });

  test("a multi-villain scenario mentions how many more villains join it", () => {
    const detail = scenarioDetailOf(breakout, CARDS_BY_ID, POOL_ENCOUNTER_SETS);
    const lines = scenarioDetailLines(detail);
    expect(lines[0]).toContain("3 more");
  });
});
