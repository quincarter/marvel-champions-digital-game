import { createGame, replay } from "@mc/engine";
import { playToOutcome } from "../../testing/driver.js";
import { wave1Scenario } from "../setup.js";
import { HLK_DEPS } from "./testing.js";

/**
 * A real game test for the `hlk` pack (docs/phase7-wave1-scripting.md "Test conventions"): the Hulk (Aggression)
 * precon against Rhino, played headlessly by the same greedy driver `../../e2e.test.ts` uses for Core, to a real win
 * or loss, then the session log replayed to a deep-equal final state.
 */
test("Rhino (standard, Bomb Scare), solo: Hulk (Aggression)", () => {
  const config = wave1Scenario("rhino", { players: [{ starterDeckId: "hlk-aggression" }], seed: 2026 });
  const created = createGame(config, HLK_DEPS);
  if (!created.ok) throw new Error(`setup failed: ${created.error.message}`);
  const result = playToOutcome(created.state, HLK_DEPS);
  console.info(
    `[wave1 e2e] Rhino (standard) — Hulk: ${result.outcome ? `${result.outcome.result} (${result.outcome.reason})` : "no outcome"} in round ${result.rounds}, ${result.commands} commands`,
  );
  expect(result.outcome).not.toBeNull();
  expect(result.rounds).toBeGreaterThanOrEqual(1);
  const replayed = replay(result.session.log, HLK_DEPS);
  expect(replayed.ok).toBe(true);
  if (replayed.ok) expect(replayed.state).toEqual(result.session.state);
}, 120_000);
