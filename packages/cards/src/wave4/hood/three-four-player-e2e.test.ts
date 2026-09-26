import { encounterSetId, type DifficultySetChoice } from "@mc/content";
import { createGame, replay } from "@mc/engine";
import { playToOutcome } from "../../testing/driver.js";
import { WAVE4_DEPS } from "../index.js";
import { hoodScenario } from "./support.js";

/**
 * Coordinator ask (2026-09-26, "full rules QA" follow-up, item 4): The Hood at 3 and 4 players, standard and expert,
 * run to completion with a deep-equal replay — `e2e.test.ts` already covers 1p (both modes) and 2p (standard); this
 * file adds 3p/4p with four distinct precons (Core Spider-Man, Core Captain Marvel, Nebula, Vision).
 */
const BOTH_II: DifficultySetChoice = { standard: encounterSetId("standard_ii"), expert: encounterSetId("expert_ii") };

function playHood(label: string, config: ReturnType<typeof hoodScenario>) {
  const created = createGame(config, WAVE4_DEPS);
  if (!created.ok) throw new Error(`setup failed: ${created.error.message}`);
  const result = playToOutcome(created.state, WAVE4_DEPS);
  console.info(
    `[wave4 e2e] ${label}: ${result.outcome ? `${result.outcome.result} (${result.outcome.reason})` : "no outcome"} in round ${result.rounds}, ${result.commands} commands`,
  );
  expect(result.outcome).not.toBeNull();
  expect(result.rounds).toBeGreaterThanOrEqual(1);
  const replayed = replay(result.session.log, WAVE4_DEPS);
  expect(replayed.ok).toBe(true);
  if (replayed.ok) expect(replayed.state).toEqual(result.session.state);
}

test("The Hood (standard, 3p): Spider-Man + Captain Marvel + Nebula", () => {
  playHood(
    "The Hood (standard, 3p)",
    hoodScenario("the-hood", {
      seed: 3126,
      extraPlayers: [{ starterDeckId: "core-captain-marvel-leadership" }, { starterDeckId: "nebula-justice" }],
    }),
  );
}, 120_000);

test("The Hood (expert, Standard II/Expert II, 4p): Spider-Man + Captain Marvel + Nebula + War Machine", () => {
  playHood(
    "The Hood (expert, 4p)",
    hoodScenario("the-hood", {
      seed: 4127,
      difficulty: "expert",
      difficultySets: BOTH_II,
      extraPlayers: [
        { starterDeckId: "core-captain-marvel-leadership" },
        { starterDeckId: "nebula-justice" },
        { starterDeckId: "war-machine-leadership" },
      ],
    }),
  );
}, 180_000);
