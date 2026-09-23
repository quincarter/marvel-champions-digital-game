import { createGame, replay } from "@mc/engine";
import { playToOutcome } from "../../testing/driver.js";
import { WAVE3_DEPS } from "../index.js";
import { draxScenario } from "./support.js";

/**
 * A real game test for Drax's own stand-in deck (docs/phase7-wave3-scripting.md "Test conventions", modeled on
 * `../gam/e2e.test.ts`): Drax (`support.ts`'s hand-built deck — he has no real precon yet, docs/phase7-wave3.md
 * §0/§2.1) against Rhino (a Core scenario, seated with wave 3 content — `wave3Scenario`'s fallback), played
 * headlessly by the card-name-agnostic greedy driver to a real win or loss, then the session log replayed to a
 * deep-equal final state. This exists to catch a Drax ability that's individually well-tested but breaks when
 * the generic driver actually drives it through a full turn cycle (a wrong cost, an untested target shape, an
 * ability that leaves a stray pending choice).
 */
test("Rhino (standard), solo: Drax", () => {
  const config = draxScenario("rhino", { seed: 2026 });
  const created = createGame(config, WAVE3_DEPS);
  if (!created.ok) throw new Error(`setup failed: ${created.error.message}`);
  const result = playToOutcome(created.state, WAVE3_DEPS);
  console.info(
    `[wave3 e2e] Rhino (standard) — Drax: ${result.outcome ? `${result.outcome.result} (${result.outcome.reason})` : "no outcome"} in round ${result.rounds}, ${result.commands} commands`,
  );
  expect(result.outcome).not.toBeNull();
  expect(result.rounds).toBeGreaterThanOrEqual(1);
  const replayed = replay(result.session.log, WAVE3_DEPS);
  expect(replayed.ok).toBe(true);
  if (replayed.ok) expect(replayed.state).toEqual(result.session.state);
}, 120_000);
