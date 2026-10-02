import { createGame, replay } from "@mc/engine";
import { describe, expect, it } from "vitest";
import { playToOutcome } from "../../testing/driver.js";
import { WAVE6_DEPS, wave6Scenario } from "../index.js";

/**
 * Whole Mansion Attack games, played by the card-name-agnostic greedy driver (`../../testing/driver.ts`) with a Core
 * hero (Spider-Man, Justice) to a real outcome; the session log must replay to the identical final state. The Mystique
 * modular set is another module, so the games run with Mansion Attack's own set, the required Brotherhood set and the
 * Standard (and Expert) sets.
 */
describe.each(["standard", "expert"] as const)("Mansion Attack (%s) with a Core hero", (difficulty) => {
  it.each([2026, 7])(
    "seed %i plays to an outcome and replays deep-equal",
    (seed) => {
      const config = wave6Scenario("mansion-attack", {
        players: [{ starterDeckId: "core-spider-man-justice" }],
        seed,
        difficulty,
        modularSetIds: [],
      });
      const created = createGame(config, WAVE6_DEPS);
      if (!created.ok) throw new Error(`setup failed: ${created.error.message}`);
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
