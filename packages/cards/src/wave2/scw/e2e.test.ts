import { createGame, replay } from "@mc/engine";
import { playToOutcome } from "../../testing/driver.js";
import { WAVE2_DEPS } from "../index.js";
import { wave2Scenario } from "../setup.js";

/**
 * Real-game test for the `scw` pack (docs/phase7-wave2-scripting.md "Test conventions"), mirroring `../ant/
 * e2e.test.ts`: the Scarlet Witch (Justice) precon played headlessly by the card-name-agnostic greedy driver to a
 * real win or loss, then the session log replayed to a deep-equal final state. Before this (rules-qa-engineer wave
 * 2 pass), `scw` had no full-game test at all.
 */
test("Rhino (standard), solo: Scarlet Witch (Justice)", () => {
  const config = wave2Scenario("rhino", { players: [{ starterDeckId: "scw-justice" }], seed: 2026 });
  const created = createGame(config, WAVE2_DEPS);
  if (!created.ok) throw new Error(`setup failed: ${created.error.message}`);
  const result = playToOutcome(created.state, WAVE2_DEPS);
  console.info(
    `[wave2 e2e] Rhino (standard) — Scarlet Witch: ${result.outcome ? `${result.outcome.result} (${result.outcome.reason})` : "no outcome"} in round ${result.rounds}, ${result.commands} commands`,
  );
  expect(result.outcome).not.toBeNull();
  expect(result.rounds).toBeGreaterThanOrEqual(1);
  const replayed = replay(result.session.log, WAVE2_DEPS);
  expect(replayed.ok).toBe(true);
  if (replayed.ok) expect(replayed.state).toEqual(result.session.state);
}, 120_000);
