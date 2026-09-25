import { describe, expect, test } from "vitest";
import { scenarioDetailLines, scenarioDetailOf, shelfSubtitleOf } from "./scenario-detail.js";
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
    // Four names don't fit a shelf card: the lead villain's name stands for the scenario.
    expect(detail.displayName).toBe(detail.villainName);
  });

  test("a two-villain scenario (Tower Defense) is shown under both names", () => {
    const towerDefense = POOL_SCENARIOS.find((s) => (s.id as string) === "tower-defense")!;
    const detail = scenarioDetailOf(towerDefense, CARDS_BY_ID, POOL_ENCOUNTER_SETS);
    expect(detail.displayName).toBe("Proxima Midnight / Corvus Glaive");
  });

  test("a single-villain scenario is shown under the villain's own name", () => {
    expect(scenarioDetailOf(rhino, CARDS_BY_ID, POOL_ENCOUNTER_SETS).displayName).toBe("Rhino");
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

describe("shelfSubtitleOf", () => {
  const detail = (id: string) =>
    scenarioDetailOf(
      POOL_SCENARIOS.find((s) => (s.id as string) === id)!,
      CARDS_BY_ID,
      POOL_ENCOUNTER_SETS,
    );

  test("a three-stage villain reads as a range, with its modular set", () => {
    expect(shelfSubtitleOf(detail("infiltrate-the-museum"), false)).toBe("Stages I–III · Menagerie Medley");
  });

  test("a one-stage villain reads 'Stage I', never 'Stages I–I'", () => {
    expect(shelfSubtitleOf(detail("escape-the-museum"), false)).toBe("Stage I · Menagerie Medley");
  });

  test("two scenarios fought against the same-named villain lead with the scenario's own name", () => {
    expect(shelfSubtitleOf(detail("infiltrate-the-museum"), true)).toBe("Infiltrate the Museum · Stages I–III");
    expect(shelfSubtitleOf(detail("escape-the-museum"), true)).toBe("Escape the Museum · Stage I");
  });

  test("in the real pool, the two Museum scenarios are the only villain names shared", () => {
    const names = POOL_SCENARIOS.map((s) => detail(s.id as string).villainName);
    const shared = POOL_SCENARIOS.filter((_, i) => names.indexOf(names[i]!) !== names.lastIndexOf(names[i]!));
    expect(shared.map((s) => s.id as string).sort()).toEqual(["escape-the-museum", "infiltrate-the-museum"]);
  });
});
