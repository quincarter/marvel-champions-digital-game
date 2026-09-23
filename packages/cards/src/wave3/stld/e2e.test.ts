import { createGame, replay } from "@mc/engine";
import { playToOutcome } from "../../testing/driver.js";
import { WAVE3_DEPS } from "../index.js";
import { wave3Scenario } from "../setup.js";
import { STAR_LORD_LEADERSHIP } from "./testing.js";

/**
 * A real game test for Star-Lord's own kit (docs/phase7-wave3-scripting.md "Test conventions", modeled on
 * `../gmw/e2e.test.ts`): Star-Lord (Leadership, built from his own pack — no precon exists, `./testing.js`'s own
 * docblock) against Rhino (a Core scenario, seated with wave 3 content — `wave3Scenario`'s fallback), played
 * headlessly by the card-name-agnostic greedy driver to a real win or loss, then the session log replayed to a
 * deep-equal final state. This exists to catch a Star-Lord ability that's individually well-tested but breaks
 * when the generic driver actually drives it through a full turn cycle (a cost-reduction ability offered on every
 * play, a multi-step `chooseOne` tree like Cosmo's, an obligation the driver has to resolve blind).
 */
test("Rhino (standard), solo: Star-Lord (Leadership)", () => {
  const config = wave3Scenario("rhino", { players: [STAR_LORD_LEADERSHIP], seed: 2026 });
  const created = createGame(config, WAVE3_DEPS);
  if (!created.ok) throw new Error(`setup failed: ${created.error.message}`);
  const result = playToOutcome(created.state, WAVE3_DEPS);
  console.info(
    `[wave3 e2e] Rhino (standard) — Star-Lord: ${result.outcome ? `${result.outcome.result} (${result.outcome.reason})` : "no outcome"} in round ${result.rounds}, ${result.commands} commands`,
  );
  expect(result.outcome).not.toBeNull();
  expect(result.rounds).toBeGreaterThanOrEqual(1);
  const replayed = replay(result.session.log, WAVE3_DEPS);
  expect(replayed.ok).toBe(true);
  if (replayed.ok) expect(replayed.state).toEqual(result.session.state);
}, 120_000);
