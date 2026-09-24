import { createGame, replay } from "@mc/engine";
import { playToOutcome } from "../../testing/driver.js";
import { WAVE3_DEPS } from "../index.js";
import { wave3Scenario } from "../setup.js";

/**
 * A real game test for Groot's own precon (docs/phase7-wave3-scripting.md "Test conventions", modeled on
 * `../../wave1/hlk/e2e.test.ts`): the Groot (Protection) precon against Rhino (a Core scenario, seated with wave 3
 * content — `wave3Scenario`'s fallback), played headlessly by the card-name-agnostic greedy driver to a real win
 * or loss, then the session log replayed to a deep-equal final state. Every unscripted `gmw` card (Rocket
 * Raccoon's kit, the five scenarios) simply has no abilities — the engine skips an unregistered ability id
 * silently — so this game is legal but easier than a real table; it exists to catch a Groot ability that's
 * individually well-tested but breaks when the generic driver actually drives it through a full turn cycle.
 */
test("Rhino (standard), solo: Groot (Protection)", () => {
  const config = wave3Scenario("rhino", { players: [{ starterDeckId: "groot-protection" }], seed: 2026 });
  const created = createGame(config, WAVE3_DEPS);
  if (!created.ok) throw new Error(`setup failed: ${created.error.message}`);
  const result = playToOutcome(created.state, WAVE3_DEPS);
  console.info(
    `[wave3 e2e] Rhino (standard) — Groot: ${result.outcome ? `${result.outcome.result} (${result.outcome.reason})` : "no outcome"} in round ${result.rounds}, ${result.commands} commands`,
  );
  expect(result.outcome).not.toBeNull();
  expect(result.rounds).toBeGreaterThanOrEqual(1);
  const replayed = replay(result.session.log, WAVE3_DEPS);
  expect(replayed.ok).toBe(true);
  if (replayed.ok) expect(replayed.state).toEqual(result.session.state);
}, 120_000);
