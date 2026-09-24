import { createGame, replay } from "@mc/engine";
import { playToOutcome } from "../../testing/driver.js";
import { WAVE3_DEPS } from "../index.js";
import { wave3Scenario } from "../setup.js";
import { STAR_LORD_LEADERSHIP } from "./testing.js";

/**
 * rules-qa-engineer wave 3 pass, `stld` (docs/phase7-wave3-qa.md has the full report). `stld` had only one solo
 * Rhino-standard game before this pass (the 2-player Gamora + Star-Lord game lives in `../gam/qa.test.ts`, next
 * to Gamora's own expert game, since neither pack has a natural home for a cross-pack test).
 */
test("Rhino (expert), solo: Star-Lord (Leadership)", () => {
  const config = wave3Scenario("rhino", { players: [STAR_LORD_LEADERSHIP], seed: 14, difficulty: "expert" });
  const created = createGame(config, WAVE3_DEPS);
  if (!created.ok) throw new Error(`setup failed: ${created.error.message}`);
  const result = playToOutcome(created.state, WAVE3_DEPS);
  console.info(
    `[wave3 qa smoke] Rhino (expert) — Star-Lord: ${result.outcome ? `${result.outcome.result} (${result.outcome.reason})` : "no outcome"} in round ${result.rounds}, ${result.commands} commands`,
  );
  expect(result.outcome).not.toBeNull();
  expect(result.rounds).toBeGreaterThanOrEqual(1);
  const replayed = replay(result.session.log, WAVE3_DEPS);
  expect(replayed.ok).toBe(true);
  if (replayed.ok) expect(replayed.state).toEqual(result.session.state);
}, 120_000);
