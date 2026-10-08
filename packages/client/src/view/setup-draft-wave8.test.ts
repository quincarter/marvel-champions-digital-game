/**
 * Wave 8 (Age of Apocalypse): every new scenario builds a legal default `SessionConfig` from the scenario-select
 * draft (standard difficulty, no modular or Horseman overrides) and the engine starts a game from it.
 */
import { describe, expect, test } from "vitest";
import { WAVE8_SCENARIOS, WAVE8_STARTER_DECKS } from "@mc/content";
import { EngineSessionCore } from "../engine/session-core.js";
import { POOL_SCENARIOS, POOL_STARTER_DECKS } from "../content/pool.js";
import { initialSetupDraft, toSessionConfig } from "./setup-draft.js";

describe("Wave 8 scenarios from the scenario-select draft", () => {
  test("the pool offers all five scenarios and all six precons", () => {
    expect(WAVE8_SCENARIOS.map((s) => s.id as string)).toEqual([
      "unus",
      "four-horsemen",
      "apocalypse",
      "dark-beast",
      "en-sabah-nur",
    ]);
    expect(WAVE8_STARTER_DECKS.length).toBe(6);
    for (const scenario of WAVE8_SCENARIOS) expect(POOL_SCENARIOS).toContain(scenario);
    for (const deck of WAVE8_STARTER_DECKS) expect(POOL_STARTER_DECKS).toContain(deck);
  });

  for (const scenario of WAVE8_SCENARIOS) {
    test(`${scenario.id as string} starts with Bishop on its default options`, async () => {
      const draft = initialSetupDraft({ scenarioId: scenario.id as string, seatDeckId: "unused", seed: 8 });
      const config = toSessionConfig(draft, [{ starterDeckId: "bishop-leadership" }], scenario);
      expect(config.difficulty).toBe("standard");
      expect(config.modularSetIds).toBeUndefined();
      const started = await new EngineSessionCore().start(config);
      expect(started.snapshot.legal).not.toBeNull();
      expect(started.snapshot.state).not.toBeNull();
    });
  }
});
