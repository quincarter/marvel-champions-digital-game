import { createGame, replay } from "@mc/engine";
import { describe, expect, it } from "vitest";
import { playToOutcome } from "../../testing/driver.js";
import { WAVE6_DEPS, wave6Scenario } from "../index.js";
import { inEncounterPile } from "./zero-tolerance-testing.js";

/**
 * Whole Master Mold games with Zero Tolerance as the modular set (the scenario's Sentinels set is required), played by
 * the card-name-agnostic greedy driver (`../../testing/driver.ts`) with a Core hero (Spider-Man, Justice) to a real
 * outcome; the session log must replay to the identical final state. Project Wideawake (where Zero Tolerance is
 * required) has its own e2e in `project-wideawake-e2e.test.ts`.
 */
describe.each(["standard", "expert"] as const)("Master Mold with Zero Tolerance (%s) and a Core hero", (difficulty) => {
  it.each([2026, 7])(
    "seed %i plays to an outcome and replays deep-equal",
    (seed) => {
      const config = wave6Scenario("master-mold", {
        players: [{ starterDeckId: "core-spider-man-justice" }],
        seed,
        difficulty,
        modularSetIds: ["zero_tolerance"],
      });
      const created = createGame(config, WAVE6_DEPS);
      if (!created.ok) throw new Error(`setup failed: ${created.error.message}`);
      // Master Mold's Setup deals each player a Sentinel, so a Mark II may already be out of the piles.
      for (const code of ["32101", "32102", "32103"])
        expect(inEncounterPile(created.state, code).length, code).toBeGreaterThanOrEqual(1);
      const result = playToOutcome(created.state, WAVE6_DEPS);
      expect(result.outcome).not.toBeNull();
      expect(result.rounds).toBeGreaterThanOrEqual(1);
      const replayed = replay(result.session.log, WAVE6_DEPS);
      expect(replayed.ok).toBe(true);
      if (replayed.ok) expect(replayed.state).toEqual(result.session.state);
    },
    120_000,
  );
});

/** Project Wideawake requires the set, so its cards come from the scenario's own card data with no `modularSetIds`. */
describe.each(["standard", "expert"] as const)(
  "Project Wideawake with its required Zero Tolerance set (%s)",
  (difficulty) => {
    it("plays to an outcome and replays deep-equal", () => {
      const config = wave6Scenario("project-wideawake", {
        players: [{ starterDeckId: "core-spider-man-justice" }],
        seed: 2026,
        difficulty,
      });
      const created = createGame(config, WAVE6_DEPS);
      if (!created.ok) throw new Error(`setup failed: ${created.error.message}`);
      for (const code of ["32101", "32102", "32103"])
        expect(inEncounterPile(created.state, code), code).toHaveLength(2);
      const result = playToOutcome(created.state, WAVE6_DEPS);
      expect(result.outcome).not.toBeNull();
      const replayed = replay(result.session.log, WAVE6_DEPS);
      expect(replayed.ok).toBe(true);
      if (replayed.ok) expect(replayed.state).toEqual(result.session.state);
    }, 120_000);
  },
);
