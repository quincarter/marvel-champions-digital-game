import { createGame, replay } from "@mc/engine";
import { playToOutcome } from "../../testing/driver.js";
import { WAVE3_DEPS } from "../index.js";
import { wave3Scenario } from "../setup.js";

/**
 * A real game test for the Galaxy's Most Wanted's own first scenario (docs/phase7-wave3-scripting.md "Test
 * conventions"): Brotherhood of Badoon (standard), Groot (Protection) solo, played headlessly by the card-name-
 * agnostic greedy driver to a real win or loss, then the session log replayed to a deep-equal final state. Exists
 * to catch an interaction that's well-tested in isolation but breaks when the whole scenario — Drang, Terrestrial
 * Invasion/Protect the Planet, Badoon Ship, the side schemes, Ship Command and Band of Badoon all in one deck —
 * runs together over a full game.
 */
test("Brotherhood of Badoon (standard), solo: Groot (Protection)", () => {
  const config = wave3Scenario("brotherhood-of-badoon", {
    players: [{ starterDeckId: "groot-protection" }],
    seed: 2026,
  });
  const created = createGame(config, WAVE3_DEPS);
  if (!created.ok) throw new Error(`setup failed: ${created.error.message}`);
  const result = playToOutcome(created.state, WAVE3_DEPS);
  console.info(
    `[wave3 e2e] Brotherhood of Badoon (standard) — Groot: ${result.outcome ? `${result.outcome.result} (${result.outcome.reason})` : "no outcome"} in round ${result.rounds}, ${result.commands} commands`,
  );
  expect(result.outcome).not.toBeNull();
  expect(result.rounds).toBeGreaterThanOrEqual(1);
  const replayed = replay(result.session.log, WAVE3_DEPS);
  expect(replayed.ok).toBe(true);
  if (replayed.ok) expect(replayed.state).toEqual(result.session.state);
}, 120_000);
