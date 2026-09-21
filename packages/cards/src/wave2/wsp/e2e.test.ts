import { createGame, replay } from "@mc/engine";
import { playToOutcome } from "../../testing/driver.js";
import { WAVE2_DEPS } from "../index.js";
import { wave2Scenario } from "../setup.js";

/**
 * Real-game test for the `wsp` pack (docs/phase7-wave2-scripting.md "Test conventions"), mirroring `../ant/
 * e2e.test.ts`: the Wasp (Aggression) precon played headlessly by the card-name-agnostic greedy driver to a real
 * win or loss, then the session log replayed to a deep-equal final state. Before this (rules-qa-engineer wave 2
 * pass), `wsp` had no full-game test at all — only `kit.test.ts`/`pack-cards.test.ts`/`obligation-nemesis.test.ts`
 * ability-level tests, which never exercise Wasp's three-face (tiny/normal/giant) size-change abilities together
 * across a real turn cycle.
 */
test("Rhino (standard), solo: Wasp (Aggression)", () => {
  const config = wave2Scenario("rhino", { players: [{ starterDeckId: "wsp-aggression" }], seed: 2026 });
  const created = createGame(config, WAVE2_DEPS);
  if (!created.ok) throw new Error(`setup failed: ${created.error.message}`);
  const result = playToOutcome(created.state, WAVE2_DEPS);
  console.info(`[wave2 e2e] Rhino (standard) — Wasp: ${result.outcome ? `${result.outcome.result} (${result.outcome.reason})` : "no outcome"} in round ${result.rounds}, ${result.commands} commands`);
  expect(result.outcome).not.toBeNull();
  expect(result.rounds).toBeGreaterThanOrEqual(1);
  const replayed = replay(result.session.log, WAVE2_DEPS);
  expect(replayed.ok).toBe(true);
  if (replayed.ok) expect(replayed.state).toEqual(result.session.state);
}, 120_000);
