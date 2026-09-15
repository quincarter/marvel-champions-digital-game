import { createGame, replay } from "@mc/engine";
import { playToOutcome } from "../../testing/driver.js";
import { GOB_DEPS } from "./testing.js";
import { wave1Scenario } from "../setup.js";

/**
 * Real game tests for the `gob` pack (docs/phase7-wave1-scripting.md "Test conventions"): Core's Spider-Man precon
 * against both Green Goblin scenarios, played headlessly by the same greedy driver `../../e2e.test.ts` uses for
 * Core, to a real win or loss — not just the individual-ability tests in `risky-business.test.ts` /
 * `mutagen-formula.test.ts` / `modular.test.ts`. This exercises `wave1Scenario`/`GOB_DEPS` end to end (setup, many
 * rounds, and a terminal outcome) and replays the session log to a deep-equal final state. A 2-player run per
 * scenario additionally exercises indirect damage assignment (docs/phase7-wave1.md §3.7 — each player divides it
 * among the characters they control) and "each player is dealt an encounter card" (§3.15's per-player dealing).
 */
describe.each([
  { scenario: "risky-business", label: "Risky Business" },
  { scenario: "mutagen-formula", label: "Mutagen Formula" },
])("wave1Scenario('$scenario')", ({ scenario, label }) => {
  test(`${label} (standard, solo): Spider-Man (Justice)`, () => {
    const config = wave1Scenario(scenario, { players: [{ starterDeckId: "core-spider-man-justice" }], seed: 2026 });
    const created = createGame(config, GOB_DEPS);
    if (!created.ok) throw new Error(`setup failed: ${created.error.message}`);
    const result = playToOutcome(created.state, GOB_DEPS);
    console.info(`[gob e2e] ${label} (standard, solo) — Spider-Man: ${result.outcome ? `${result.outcome.result} (${result.outcome.reason})` : "no outcome"} in round ${result.rounds}, ${result.commands} commands`);
    expect(result.outcome).not.toBeNull();
    expect(result.rounds).toBeGreaterThanOrEqual(1);
    const replayed = replay(result.session.log, GOB_DEPS);
    expect(replayed.ok).toBe(true);
    if (replayed.ok) expect(replayed.state).toEqual(result.session.state);
  }, 120_000);

  test(`${label} (standard, 2-player): Spider-Man (Justice) and Captain Marvel (Leadership)`, () => {
    const config = wave1Scenario(scenario, {
      players: [{ starterDeckId: "core-spider-man-justice" }, { starterDeckId: "core-captain-marvel-leadership" }],
      seed: 2027,
    });
    const created = createGame(config, GOB_DEPS);
    if (!created.ok) throw new Error(`setup failed: ${created.error.message}`);
    const result = playToOutcome(created.state, GOB_DEPS);
    console.info(`[gob e2e] ${label} (standard, 2-player) — Spider-Man/Captain Marvel: ${result.outcome ? `${result.outcome.result} (${result.outcome.reason})` : "no outcome"} in round ${result.rounds}, ${result.commands} commands`);
    expect(result.outcome).not.toBeNull();
    expect(result.rounds).toBeGreaterThanOrEqual(1);
    const replayed = replay(result.session.log, GOB_DEPS);
    expect(replayed.ok).toBe(true);
    if (replayed.ok) expect(replayed.state).toEqual(result.session.state);
  }, 120_000);
});
