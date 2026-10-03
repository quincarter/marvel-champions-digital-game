import { createGame, replay } from "@mc/engine";
import { describe, expect, it } from "vitest";
import { playToOutcome } from "../../../testing/driver.js";
import { WAVE6_DEPS, wave6Scenario } from "../../index.js";
import { EXODUS, SHIELD } from "./testing.js";
import { instancesOf } from "../../../testing/harness.js";

/**
 * Whole Rhino games with Exodus as the modular set, played by the card-name-agnostic greedy driver
 * (`../../../testing/driver.ts`) with a Core hero to a real outcome; the session log must replay to the identical
 * final state.
 */
describe.each(["standard", "expert"] as const)("Rhino with the Exodus modular (%s) and a Core hero", (difficulty) => {
  it.each([2026, 7])(
    "seed %i plays to an outcome and replays deep-equal",
    (seed) => {
      const config = wave6Scenario("rhino", {
        players: [{ starterDeckId: "core-spider-man-justice" }],
        seed,
        difficulty,
        modularSetIds: ["exodus"],
      });
      const created = createGame(config, WAVE6_DEPS);
      if (!created.ok) throw new Error(`setup failed: ${created.error.message}`);
      expect(instancesOf(created.state, EXODUS)).toHaveLength(1);
      expect(instancesOf(created.state, SHIELD)).toHaveLength(2);
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
