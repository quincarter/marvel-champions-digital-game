import { createGame, replay } from "@mc/engine";
import { playToOutcome } from "../../testing/driver.js";
import { WAVE3_DEPS } from "../index.js";
import { wave3Scenario } from "../setup.js";

/**
 * A real game test for The Galaxy's Most Wanted's fifth scenario (docs/phase7-wave3-scripting.md "Test
 * conventions"): Ronan the Accuser (standard), Groot (Protection) solo, played headlessly by the card-name-
 * agnostic greedy driver to a real win or loss, then the session log replayed to a deep-equal final state.
 */
test("Ronan the Accuser (standard), solo: Groot (Protection)", () => {
  const config = wave3Scenario("ronan-the-accuser", {
    players: [{ starterDeckId: "groot-protection" }],
    seed: 2026,
  });
  const created = createGame(config, WAVE3_DEPS);
  if (!created.ok) throw new Error(`setup failed: ${created.error.message}`);
  const result = playToOutcome(created.state, WAVE3_DEPS);
  console.info(
    `[wave3 e2e] Ronan the Accuser (standard) — Groot: ${result.outcome ? `${result.outcome.result} (${result.outcome.reason})` : "no outcome"} in round ${result.rounds}, ${result.commands} commands`,
  );
  expect(result.outcome).not.toBeNull();
  expect(result.rounds).toBeGreaterThanOrEqual(1);
  const replayed = replay(result.session.log, WAVE3_DEPS);
  expect(replayed.ok).toBe(true);
  if (replayed.ok) expect(replayed.state).toEqual(result.session.state);
}, 120_000);
