import { createGame, replay } from "@mc/engine";
import { describe, expect, it } from "vitest";
import { playToOutcome } from "../../../testing/driver.js";
import { WAVE6_DEPS, wave6Scenario } from "../../index.js";

/**
 * A whole game with Wolverine's own precon (`wolverine-aggression`, `packages/content/src/data/wolv/starterDecks.ts`),
 * played by the card-name-agnostic greedy driver to a real outcome; the log replays deep-equal. Wolverine's Claws action
 * is not scripted yet (§3.42), so the driver never uses it.
 */
describe("Wolverine (wolverine-aggression) vs Rhino", () => {
  it("solo, standard: plays to an outcome and replays deep-equal", () => {
    const config = wave6Scenario("rhino", { players: [{ starterDeckId: "wolverine-aggression" }], seed: 2026 });
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
