import { createGame, replay } from "@mc/engine";
import { playToOutcome } from "../../testing/driver.js";
import { WAVE4_DEPS } from "../index.js";
import { spectrumScenario } from "./support.js";

/**
 * Coordinator ask (2026-09-26, "full rules QA" follow-up, item 4): every `mts` scenario at 3 and 4 players, standard
 * and expert, run to completion with a deep-equal replay — beyond `two-player-e2e.test.ts` (2p, standard only). Four
 * distinct wave-4 precons (Spectrum, Adam Warlock, Nebula, War Machine) rather than four copies of one, so the
 * shared encounter deck (Tower Defense) and per-player setup effects (Loki's random start, Hela's Odin
 * capture/free) are actually exercised with heterogeneous decks, not four identical seats.
 */
const SCENARIOS = ["ebony-maw", "thanos", "hela", "loki", "tower-defense"] as const;
const DIFFICULTIES = ["standard", "expert"] as const;

const THIRD_PLAYER = { starterDeckId: "nebula-justice" } as const;
const FOURTH_PLAYER = { starterDeckId: "war-machine-leadership" } as const;

describe.each(SCENARIOS)("3-player: Spectrum + Adam Warlock + Nebula vs %s", (scenarioId) => {
  it.each(DIFFICULTIES)(
    "%s: reaches a real outcome and replays deterministically",
    (difficulty) => {
      const config = spectrumScenario(scenarioId, {
        seed: 3103,
        difficulty,
        extraPlayers: [{ starterDeckId: "adam-warlock-all-aspects" }, THIRD_PLAYER],
      });
      const created = createGame(config, WAVE4_DEPS);
      if (!created.ok) throw new Error(`setup failed: ${created.error.message}`);
      const result = playToOutcome(created.state, WAVE4_DEPS);
      console.info(
        `[wave4 e2e] ${scenarioId} (${difficulty}, 3p): ${result.outcome ? `${result.outcome.result} (${result.outcome.reason})` : "no outcome"} in round ${result.rounds}, ${result.commands} commands`,
      );
      expect(result.outcome).not.toBeNull();
      expect(result.rounds).toBeGreaterThanOrEqual(1);
      const replayed = replay(result.session.log, WAVE4_DEPS);
      expect(replayed.ok).toBe(true);
      if (replayed.ok) expect(replayed.state).toEqual(result.session.state);
    },
    120_000,
  );
});

describe.each(SCENARIOS)("4-player: Spectrum + Adam Warlock + Nebula + War Machine vs %s", (scenarioId) => {
  it.each(DIFFICULTIES)(
    "%s: reaches a real outcome and replays deterministically",
    (difficulty) => {
      const config = spectrumScenario(scenarioId, {
        seed: 4104,
        difficulty,
        extraPlayers: [{ starterDeckId: "adam-warlock-all-aspects" }, THIRD_PLAYER, FOURTH_PLAYER],
      });
      const created = createGame(config, WAVE4_DEPS);
      if (!created.ok) throw new Error(`setup failed: ${created.error.message}`);
      const result = playToOutcome(created.state, WAVE4_DEPS);
      console.info(
        `[wave4 e2e] ${scenarioId} (${difficulty}, 4p): ${result.outcome ? `${result.outcome.result} (${result.outcome.reason})` : "no outcome"} in round ${result.rounds}, ${result.commands} commands`,
      );
      expect(result.outcome).not.toBeNull();
      expect(result.rounds).toBeGreaterThanOrEqual(1);
      const replayed = replay(result.session.log, WAVE4_DEPS);
      expect(replayed.ok).toBe(true);
      if (replayed.ok) expect(replayed.state).toEqual(result.session.state);
    },
    180_000,
  );
});
