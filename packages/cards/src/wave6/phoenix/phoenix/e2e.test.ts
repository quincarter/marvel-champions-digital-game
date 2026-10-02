import { createGame, replay } from "@mc/engine";
import { describe, expect, it } from "vitest";
import { playToOutcome } from "../../../testing/driver.js";
import { WAVE6_DEPS, wave6Scenario } from "../../index.js";

/**
 * A short game with Phoenix's own precon (`phoenix-justice`, `packages/content/src/data/phoenix/starterDecks.ts`):
 * the card-name-agnostic greedy driver plays a few rounds and the log replays deep-equal. Her kit beyond the identity
 * and Phoenix Force is not scripted yet, so the full-game e2e (to an outcome) comes with the precon's cards.
 */
describe("Phoenix (phoenix-justice) vs Rhino", () => {
  it("plays rounds with Phoenix Force in play and replays deep-equal", () => {
    const created = createGame(
      wave6Scenario("rhino", { players: [{ starterDeckId: "phoenix-justice" }], seed: 2026 }),
      WAVE6_DEPS,
    );
    if (!created.ok) throw new Error(created.error.message);
    const result = playToOutcome(created.state, WAVE6_DEPS, { maxCommands: 150 });
    expect(result.rounds).toBeGreaterThanOrEqual(1);
    const replayed = replay(result.session.log, WAVE6_DEPS);
    expect(replayed.ok).toBe(true);
    if (replayed.ok) expect(replayed.state).toEqual(result.session.state);
  }, 120_000);
});
