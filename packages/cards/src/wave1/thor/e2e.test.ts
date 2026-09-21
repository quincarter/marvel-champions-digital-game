import { createGame, replay } from "@mc/engine";
import { playToOutcome } from "../../testing/driver.js";
import { wave1Scenario } from "../setup.js";
import { THOR_DEPS } from "./testing.js";

/**
 * A real game test for the Thor pack (docs/phase7-wave1-scripting.md "Test conventions"): the Thor (Aggression)
 * precon against Rhino, played headlessly by the same greedy driver `../../e2e.test.ts` uses for Core, to a real
 * win or loss — not just the individual-ability tests in `thor.test.ts`/`nemesis.test.ts`/`pack-cards.test.ts`.
 * This exercises `THOR_DEPS` end to end (setup, the obligation shuffled in, a full round and beyond) and replays
 * the session log to a deep-equal final state. Uses local `THOR_DEPS` (`./testing.js`), not the shared
 * `wave1/index.ts`'s `WAVE1_DEPS`, per the shared-tree rules this pack agent works under.
 */
test("Rhino (standard, Bomb Scare), solo: Thor (Aggression)", () => {
  const config = wave1Scenario("rhino", { players: [{ starterDeckId: "thor-aggression" }], seed: 2026 });
  const created = createGame(config, THOR_DEPS);
  if (!created.ok) throw new Error(`setup failed: ${created.error.message}`);
  const result = playToOutcome(created.state, THOR_DEPS);
  console.info(
    `[wave1 e2e] Rhino (standard) — Thor: ${result.outcome ? `${result.outcome.result} (${result.outcome.reason})` : "no outcome"} in round ${result.rounds}, ${result.commands} commands`,
  );
  expect(result.outcome).not.toBeNull();
  expect(result.rounds).toBeGreaterThanOrEqual(1);
  const replayed = replay(result.session.log, THOR_DEPS);
  expect(replayed.ok).toBe(true);
  if (replayed.ok) expect(replayed.state).toEqual(result.session.state);
}, 120_000);
