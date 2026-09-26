import { createGame, replay } from "@mc/engine";
import { playToOutcome } from "../../testing/driver.js";
import { WAVE4_DEPS } from "../index.js";
import { warMachineScenario } from "./support.js";

/**
 * A real game test for War Machine's own real precon (`war-machine-leadership`, docs/phase7-wave4.md §2.1) against
 * Rhino (a Core scenario, seated with the wave 4 pool — `wave4Scenario`'s fallback), played headlessly by the
 * card-name-agnostic greedy driver to a real win or loss, then the session log replayed to a deep-equal final
 * state. Modeled on `../nebu/e2e.test.ts`. This exists to catch an ability that's individually well-tested but
 * breaks when the generic driver actually drives it through a full turn cycle (the identity's own ammo-counter
 * loop across a hero/alter-ego flip, the weapon events that spend it, Munitions Bunker's cross-form move) — exactly
 * the kind of cross-ability interaction a single unit test can't catch.
 */
test("Rhino (standard), solo: War Machine", () => {
  const config = warMachineScenario("rhino", { seed: 2026 });
  const created = createGame(config, WAVE4_DEPS);
  if (!created.ok) throw new Error(`setup failed: ${created.error.message}`);
  const result = playToOutcome(created.state, WAVE4_DEPS);
  console.info(
    `[wave4 e2e] Rhino (standard) — War Machine: ${result.outcome ? `${result.outcome.result} (${result.outcome.reason})` : "no outcome"} in round ${result.rounds}, ${result.commands} commands`,
  );
  expect(result.outcome).not.toBeNull();
  expect(result.rounds).toBeGreaterThanOrEqual(1);
  const replayed = replay(result.session.log, WAVE4_DEPS);
  expect(replayed.ok).toBe(true);
  if (replayed.ok) expect(replayed.state).toEqual(result.session.state);
}, 120_000);
