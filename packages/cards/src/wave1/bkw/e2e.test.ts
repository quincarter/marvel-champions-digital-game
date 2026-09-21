import { createGame, replay } from "@mc/engine";
import { playToOutcome } from "../../testing/driver.js";
import { wave1Scenario } from "../setup.js";
import { BKW_DEPS } from "./testing.js";

/**
 * A real game test for the `bkw` pack (docs/phase7-wave1-scripting.md "Test conventions"): the Black Widow
 * (Justice) precon against Rhino, played headlessly by the same greedy driver `../../e2e.test.ts` uses for Core, to
 * a real win or loss — not just the individual-ability tests in `black-widow.test.ts`/`nemesis.test.ts`. This
 * exercises `wave1Scenario`/`BKW_DEPS` end to end (setup, a full round and beyond) and replays the session log to a
 * deep-equal final state.
 *
 * Uses `BKW_DEPS` (this pack's own local deps — see `./testing.ts`), not `../index.ts`'s `WAVE1_DEPS`: `bkw` isn't
 * registered in `wave1/index.ts` yet (the main session adds that one line once this pack is done), so `WAVE1_DEPS`
 * doesn't know any Black Widow ability id yet.
 */
test("Rhino (standard, Bomb Scare), solo: Black Widow (Justice)", () => {
  const config = wave1Scenario("rhino", { players: [{ starterDeckId: "bkw-justice" }], seed: 2026 });
  const created = createGame(config, BKW_DEPS);
  if (!created.ok) throw new Error(`setup failed: ${created.error.message}`);
  const result = playToOutcome(created.state, BKW_DEPS);
  console.info(
    `[wave1 e2e] Rhino (standard) — Black Widow: ${result.outcome ? `${result.outcome.result} (${result.outcome.reason})` : "no outcome"} in round ${result.rounds}, ${result.commands} commands`,
  );
  expect(result.outcome).not.toBeNull();
  expect(result.rounds).toBeGreaterThanOrEqual(1);
  const replayed = replay(result.session.log, BKW_DEPS);
  expect(replayed.ok).toBe(true);
  if (replayed.ok) expect(replayed.state).toEqual(result.session.state);
}, 120_000);
