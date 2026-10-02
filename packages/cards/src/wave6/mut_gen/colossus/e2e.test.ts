import { createGame, replay } from "@mc/engine";
import { describe, expect, it } from "vitest";
import { playToOutcome } from "../../../testing/driver.js";
import { WAVE6_DEPS, wave6Scenario } from "../../index.js";

/**
 * A whole game with Colossus's own precon (`colossus-protection`) against Rhino (a Core scenario), played by the
 * card-name-agnostic greedy driver to a real outcome. Only his identity is scripted so far, so the rest of the deck
 * does nothing special; the log must replay to the identical final state.
 */
describe("Colossus (colossus-protection) vs Rhino", () => {
  it("plays to an outcome and replays deep-equal", () => {
    const config = wave6Scenario("rhino", { players: [{ starterDeckId: "colossus-protection" }], seed: 2026 });
    const created = createGame(config, WAVE6_DEPS);
    if (!created.ok) throw new Error(`setup failed: ${created.error.message}`);
    const result = playToOutcome(created.state, WAVE6_DEPS);
    expect(result.outcome).not.toBeNull();
    expect(result.rounds).toBeGreaterThanOrEqual(1);
    const replayed = replay(result.session.log, WAVE6_DEPS);
    expect(replayed.ok).toBe(true);
    if (replayed.ok) expect(replayed.state).toEqual(result.session.state);
  }, 120_000);
});
