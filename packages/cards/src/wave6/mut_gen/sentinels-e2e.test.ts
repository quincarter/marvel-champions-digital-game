import { createGame, replay } from "@mc/engine";
import { describe, expect, it } from "vitest";
import { playToOutcome } from "../../testing/driver.js";
import { WAVE6_DEPS, wave6Scenario } from "../index.js";
import { inEncounterPiles } from "./acolytes-testing.js";

/**
 * Whole games with the Sentinels set in the encounter deck, played by the card-name-agnostic greedy driver
 * (`../../testing/driver.ts`) with a Core hero (Spider-Man, Justice) to a real outcome; the session log must replay to
 * the identical final state. Project Wideawake lists the Sentinels as a modular set; Master Mold requires it, so its
 * cards come from the emitted data there too.
 */
describe.each(["standard", "expert"] as const)("Sentinels set (%s) with a Core hero", (difficulty) => {
  it.each(["project-wideawake", "master-mold"] as const)(
    "%s plays to an outcome and replays deep-equal",
    (scenario) => {
      const config = wave6Scenario(scenario, {
        players: [{ starterDeckId: "core-spider-man-justice" }],
        seed: 2026,
        difficulty,
        ...(scenario === "master-mold" ? { modularSetIds: [] } : {}),
      });
      const created = createGame(config, WAVE6_DEPS);
      if (!created.ok) throw new Error(`setup failed: ${created.error.message}`);
      for (const code of ["32105", "32106", "32107", "32108"]) {
        expect(inEncounterPiles(created.state, code).length, code).toBeGreaterThan(0);
      }
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
