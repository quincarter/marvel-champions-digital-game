import { createGame, replay } from "@mc/engine";
import { playToOutcome } from "../../testing/driver.js";
import { WAVE4_DEPS } from "../index.js";
import { spectrumScenario } from "./support.js";

/**
 * docs/phase7-wave4-qa.md checkpoint 2, item D: every `mts` scenario's own `e2e.test.ts`/`*-e2e.test.ts` was solo
 * only before this file (Spectrum alone) — no 2-player game existed for Ebony Maw, Thanos, Hela, Loki or Tower
 * Defense. Table-driven rather than five near-identical files: Spectrum plus Adam Warlock (both real precons,
 * `spectrum-leadership`/`adam-warlock-all-aspects`), standard mode, one seed per scenario, played headlessly by the
 * card-name-agnostic greedy driver to a real outcome, then the session log replayed to a deep-equal final state.
 */
const SCENARIOS = ["ebony-maw", "thanos", "hela", "loki", "tower-defense"] as const;

describe.each(SCENARIOS)("2-player, standard: Spectrum + Adam Warlock vs %s", (scenarioId) => {
  it(`reaches a real outcome and replays deterministically`, () => {
    const config = spectrumScenario(scenarioId, {
      seed: 3026,
      extraPlayers: [{ starterDeckId: "adam-warlock-all-aspects" }],
    });
    const created = createGame(config, WAVE4_DEPS);
    if (!created.ok) throw new Error(`setup failed: ${created.error.message}`);
    const result = playToOutcome(created.state, WAVE4_DEPS);
    console.info(
      `[wave4 e2e] ${scenarioId} (standard, 2p) — Spectrum + Adam Warlock: ${result.outcome ? `${result.outcome.result} (${result.outcome.reason})` : "no outcome"} in round ${result.rounds}, ${result.commands} commands`,
    );
    expect(result.outcome).not.toBeNull();
    expect(result.rounds).toBeGreaterThanOrEqual(1);
    const replayed = replay(result.session.log, WAVE4_DEPS);
    expect(replayed.ok).toBe(true);
    if (replayed.ok) expect(replayed.state).toEqual(result.session.state);
  }, 120_000);
});
