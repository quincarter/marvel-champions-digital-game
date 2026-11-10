import { describe, expect, test } from "vitest";
import { POOL_SCENARIOS } from "../content/pool.js";
import { hasRandomVillain, scenarioCardIdOf } from "./random-villain.js";

const scenario = (name: string) => POOL_SCENARIOS.find((s) => s.name === name)!;

describe("the card that stands for a scenario", () => {
  test("a scenario with a known villain shows that villain", () => {
    const rhino = scenario("Rhino");
    expect(scenarioCardIdOf(rhino)).toBe(rhino.villainCardId);
  });

  test("a villain drawn at random is not promised: the main scheme stands in", () => {
    const shadows = scenario("Shadows in the Night");
    expect(hasRandomVillain(shadows)).toBe(true);
    expect(scenarioCardIdOf(shadows)).toBe(shadows.mainSchemeCardId);
  });

  test("every scenario in the pool whose villain is unknown shows its main scheme", () => {
    const random = POOL_SCENARIOS.filter(hasRandomVillain);
    expect(random.length).toBeGreaterThan(1);
    for (const s of random) expect(scenarioCardIdOf(s), s.name).toBe(s.mainSchemeCardId);
  });
});
