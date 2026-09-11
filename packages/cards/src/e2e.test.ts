import { createGame, replay, type GameSetupConfig } from "@mc/engine";
import { CORE_DEPS, coreScenario } from "./core/index.js";
import { playToOutcome } from "./testing/driver.js";

/**
 * Full games from real Core data only: set up with `coreScenario`, played
 * headlessly by the greedy driver to a win or loss, then replayed from the
 * session log to a deep-equal final state.
 */
function playAndReplay(label: string, config: GameSetupConfig) {
  const created = createGame(config, CORE_DEPS);
  if (!created.ok) throw new Error(`${label}: setup failed: ${created.error.message}`);
  const result = playToOutcome(created.state, CORE_DEPS);
  const outcome = result.outcome;
  console.info(`[e2e] ${label}: ${outcome ? `${outcome.result} (${outcome.reason})` : "no outcome"} in round ${result.rounds}, ${result.commands} commands`);
  return { result, replayed: replay(result.session.log, CORE_DEPS) };
}

test("Spider-Man (Justice precon) vs Rhino, standard, solo: plays to an outcome and replays identically", () => {
  const { result, replayed } = playAndReplay(
    "Rhino (standard) — Spider-Man",
    coreScenario("rhino", { players: [{ starterDeckId: "core-spider-man-justice" }], seed: 2026 }),
  );
  expect(result.outcome).not.toBeNull();
  expect(replayed.ok).toBe(true);
  if (replayed.ok) expect(replayed.state).toEqual(result.session.state);
}, 120_000);
