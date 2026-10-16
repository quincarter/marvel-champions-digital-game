import { describe, expect, test } from "vitest";
import { buildScenario, CARDS_BY_ID, POOL_SCENARIOS } from "../content/pool.js";
import { modularDealBlockOf, modularSetOptionsFor } from "./modular-sets.js";
import { offersRandomModularSets, randomModularSetIds, withRandomModularSets } from "./modular-random.js";
import { initialSetupDraft, toSessionConfig } from "./setup-draft.js";

const scenarioOf = (id: string) => POOL_SCENARIOS.find((s) => (s.id as string) === id)!;
const draftFor = (id: string) =>
  initialSetupDraft({ scenarioId: id, seatDeckId: "precon:core-spider-man-justice", seed: 1 });

/** A seeded stand-in for Math.random (mulberry32), so each draw is repeatable. */
function seeded(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 2 ** 32;
  };
}

describe("randomModularSetIds", () => {
  test("draws the scenario's count, no set twice, each one a tile the table could pick", () => {
    for (const id of ["rhino", "four-horsemen", "red-skull"]) {
      const scenario = scenarioOf(id);
      const draft = draftFor(id);
      const picks = randomModularSetIds(draft, scenario, CARDS_BY_ID, seeded(7))!;
      expect(picks, id).toHaveLength(scenario.modularSetCount ?? 1);
      expect(new Set(picks).size, id).toBe(picks.length);
      const pickable = new Set(
        modularSetOptionsFor({ ...draft, modularSetIds: [] }, scenario, CARDS_BY_ID)
          .filter((o) => o.kind === "set" && o.disabledReason === null)
          .map((o) => o.id),
      );
      for (const pick of picks) expect(pickable.has(pick), `${id}: ${pick}`).toBe(true);
    }
  });

  test("the drawn picks deal: the game builds from them", () => {
    const scenario = scenarioOf("four-horsemen");
    const drawn = withRandomModularSets(draftFor("four-horsemen"), scenario, CARDS_BY_ID, seeded(3));
    expect(modularDealBlockOf(drawn, scenario)).toBeNull();
    expect(() =>
      buildScenario("four-horsemen", toSessionConfig(drawn, [{ starterDeckId: "core-spider-man-justice" }], scenario)),
    ).not.toThrow();
  });

  test("different draws give different sets (the button is worth pressing twice)", () => {
    const scenario = scenarioOf("rhino");
    const draws = new Set(
      [1, 2, 3, 4, 5, 6, 7, 8].map(
        (seed) => randomModularSetIds(draftFor("rhino"), scenario, CARDS_BY_ID, seeded(seed))![0],
      ),
    );
    expect(draws.size).toBeGreaterThan(1);
  });

  test("no button where the scenario has its own pool (MojoMania) or takes no modular set (Breakout)", () => {
    expect(offersRandomModularSets(scenarioOf("mojo"), 1)).toBe(false);
    expect(offersRandomModularSets(scenarioOf("breakout"), 1)).toBe(false);
    expect(offersRandomModularSets(scenarioOf("rhino"), 1)).toBe(true);
    const breakout = draftFor("breakout");
    expect(withRandomModularSets(breakout, scenarioOf("breakout"), CARDS_BY_ID)).toBe(breakout);
  });
});
