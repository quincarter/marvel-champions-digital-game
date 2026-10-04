import { createGame, replay } from "@mc/engine";
import { describe, expect, it } from "vitest";
import { playToOutcome } from "../../testing/driver.js";
import { WAVE6_DEPS, wave6Scenario } from "../index.js";
import { inEncounterPiles } from "./mystique-testing.js";

/**
 * Whole Sabretooth games with the Mystique modular set (the Brotherhood is another module), played by the
 * card-name-agnostic greedy driver (`../../testing/driver.ts`) with a Core hero (Spider-Man, Justice) to a real outcome;
 * the session log must replay to the identical final state.
 */
describe.each(["standard", "expert"] as const)(
  "Sabretooth with the Mystique modular (%s) and a Core hero",
  (difficulty) => {
    it.each([2026, 7])(
      "seed %i plays to an outcome and replays deep-equal",
      (seed) => {
        const config = wave6Scenario("sabretooth", {
          players: [{ starterDeckId: "core-spider-man-justice" }],
          seed,
          difficulty,
          modularSetIds: ["mystique"],
        });
        const created = createGame(config, WAVE6_DEPS);
        if (!created.ok) throw new Error(`setup failed: ${created.error.message}`);
        // The set's five cards are dealt into the encounter deck from data; the stay-in-hand rule rides the config.
        expect(inEncounterPiles(created.state, "32080")).toHaveLength(1);
        expect(inEncounterPiles(created.state, "32082")).toHaveLength(2);
        expect(config.scenarioRuleSpecs).toEqual([
          { kind: "staysInHand", cards: { categories: ["treachery"], trait: "SHAPESHIFTER" } },
        ]);
        const result = playToOutcome(created.state, WAVE6_DEPS);
        expect(result.outcome).not.toBeNull();
        expect(result.rounds).toBeGreaterThanOrEqual(1);
        const replayed = replay(result.session.log, WAVE6_DEPS);
        expect(replayed.ok).toBe(true);
        if (replayed.ok) expect(replayed.state).toEqual(result.session.state);
      },
      120_000,
    );
  },
);
