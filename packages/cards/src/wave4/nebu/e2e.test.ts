import { createGame, replay } from "@mc/engine";
import { playToOutcome } from "../../testing/driver.js";
import { WAVE4_DEPS } from "../index.js";
import { nebulaScenario } from "./support.js";

/**
 * A real game test for Nebula's own real precon (`nebula-justice`, docs/phase7-wave4.md §2.1) against Rhino (a
 * Core scenario, seated with the wave 4 pool — `wave4Scenario`'s fallback), played headlessly by the card-name-
 * agnostic greedy driver to a real win or loss, then the session log replayed to a deep-equal final state. Modeled
 * on `../../wave3/drax/e2e.test.ts`. This exists to catch a Nebula ability that's individually well-tested but
 * breaks when the generic driver actually drives it through a full turn cycle (a wrong cost, an untested target
 * shape, an ability that leaves a stray pending choice) — the "Special" resolution chain (Combat Protocols,
 * Cybernetic Upgrades, Gamora, Combat Ready, Lethal Intent all touching the same technique upgrades) is exactly
 * the kind of cross-ability interaction a single unit test can't catch.
 */
test("Rhino (standard), solo: Nebula", () => {
  const config = nebulaScenario("rhino", { seed: 2026 });
  const created = createGame(config, WAVE4_DEPS);
  if (!created.ok) throw new Error(`setup failed: ${created.error.message}`);
  const result = playToOutcome(created.state, WAVE4_DEPS);
  console.info(
    `[wave4 e2e] Rhino (standard) — Nebula: ${result.outcome ? `${result.outcome.result} (${result.outcome.reason})` : "no outcome"} in round ${result.rounds}, ${result.commands} commands`,
  );
  expect(result.outcome).not.toBeNull();
  expect(result.rounds).toBeGreaterThanOrEqual(1);
  const replayed = replay(result.session.log, WAVE4_DEPS);
  expect(replayed.ok).toBe(true);
  if (replayed.ok) expect(replayed.state).toEqual(result.session.state);
}, 120_000);
