import { replay } from "@mc/engine";
import { createGame } from "@mc/engine";
import { playToOutcome } from "../../testing/driver.js";
import { wave1Scenario } from "../setup.js";
import { WAVE1_DEPS } from "../index.js";

/**
 * A real game test for the wave 1 foundation pass (docs/phase7-wave1-scripting.md "Test conventions"): the
 * Captain America (Leadership) precon against Rhino, played headlessly by the same greedy driver `../../e2e.test.ts`
 * uses for Core, to a real win or loss — not just the individual-ability tests in `captain-america.test.ts`. This
 * exercises `wave1Scenario`/`WAVE1_DEPS` end to end (setup, the obligation and nemesis set shuffled in, a full
 * round and beyond) and replays the session log to a deep-equal final state.
 */
test("Rhino (standard, Bomb Scare), solo: Captain America (Leadership)", () => {
  const config = wave1Scenario("rhino", { players: [{ starterDeckId: "cap-leadership" }], seed: 2026 });
  const created = createGame(config, WAVE1_DEPS);
  if (!created.ok) throw new Error(`setup failed: ${created.error.message}`);
  const result = playToOutcome(created.state, WAVE1_DEPS);
  console.info(`[wave1 e2e] Rhino (standard) — Captain America: ${result.outcome ? `${result.outcome.result} (${result.outcome.reason})` : "no outcome"} in round ${result.rounds}, ${result.commands} commands`);
  expect(result.outcome).not.toBeNull();
  expect(result.rounds).toBeGreaterThanOrEqual(1);
  const replayed = replay(result.session.log, WAVE1_DEPS);
  expect(replayed.ok).toBe(true);
  if (replayed.ok) expect(replayed.state).toEqual(result.session.state);
}, 120_000);
