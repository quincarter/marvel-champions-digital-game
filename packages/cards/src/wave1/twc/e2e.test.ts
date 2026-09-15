import { createGame, replay } from "@mc/engine";
import { playToOutcome } from "../../testing/driver.js";
import { wave1Scenario } from "../setup.js";
import { TWC_DEPS } from "./testing.js";

/**
 * Real game tests for the `twc` pack (docs/phase7-wave1-scripting.md "Test conventions"): Core's Spider-Man precon
 * against Breakout, played headlessly by the same greedy driver `../../e2e.test.ts` uses for Core, to a real win or
 * loss — not just the individual-ability tests in `breakout.test.ts` / `wrecker.test.ts` / `thunderball.test.ts` /
 * `piledriver.test.ts` / `bulldozer.test.ts`. This exercises `wave1Scenario('breakout')`/`TWC_DEPS` end to end
 * (setup, four villains in play, many rounds, and a terminal outcome) and replays the session log to a deep-equal
 * final state. A 2-player run additionally exercises indirect damage assignment and "each player is dealt an
 * encounter card" against a scenario with several encounter decks at once (§3.2).
 */
describe("wave1Scenario('breakout')", () => {
  test("standard, solo: Spider-Man (Justice)", () => {
    const config = wave1Scenario("breakout", { players: [{ starterDeckId: "core-spider-man-justice" }], seed: 2026 });
    const created = createGame(config, TWC_DEPS);
    if (!created.ok) throw new Error(`setup failed: ${created.error.message}`);
    const result = playToOutcome(created.state, TWC_DEPS);
    console.info(`[twc e2e] Breakout (standard, solo) — Spider-Man: ${result.outcome ? `${result.outcome.result} (${result.outcome.reason})` : "no outcome"} in round ${result.rounds}, ${result.commands} commands`);
    expect(result.outcome).not.toBeNull();
    expect(result.rounds).toBeGreaterThanOrEqual(1);
    const replayed = replay(result.session.log, TWC_DEPS);
    expect(replayed.ok).toBe(true);
    if (replayed.ok) expect(replayed.state).toEqual(result.session.state);
  }, 120_000);

  test("standard, 2-player: Spider-Man (Justice) and Captain Marvel (Leadership)", () => {
    const config = wave1Scenario("breakout", {
      players: [{ starterDeckId: "core-spider-man-justice" }, { starterDeckId: "core-captain-marvel-leadership" }],
      seed: 2027,
    });
    const created = createGame(config, TWC_DEPS);
    if (!created.ok) throw new Error(`setup failed: ${created.error.message}`);
    const result = playToOutcome(created.state, TWC_DEPS);
    console.info(`[twc e2e] Breakout (standard, 2-player) — Spider-Man/Captain Marvel: ${result.outcome ? `${result.outcome.result} (${result.outcome.reason})` : "no outcome"} in round ${result.rounds}, ${result.commands} commands`);
    expect(result.outcome).not.toBeNull();
    expect(result.rounds).toBeGreaterThanOrEqual(1);
    const replayed = replay(result.session.log, TWC_DEPS);
    expect(replayed.ok).toBe(true);
    if (replayed.ok) expect(replayed.state).toEqual(result.session.state);
  }, 120_000);
});
