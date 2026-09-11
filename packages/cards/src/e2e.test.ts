import { createGame, replay, type GameSetupConfig } from "@mc/engine";
import { CORE_DEPS, coreScenario } from "./core/index.js";
import { playToOutcome } from "./testing/driver.js";

/**
 * Full games from real Core data only: set up with `coreScenario`, played
 * headlessly by the greedy driver to a win or loss, then replayed from the
 * session log to a deep-equal final state.
 */
function playAndReplay(label: string, config: GameSetupConfig): void {
  const created = createGame(config, CORE_DEPS);
  if (!created.ok) throw new Error(`${label}: setup failed: ${created.error.message}`);
  const result = playToOutcome(created.state, CORE_DEPS);
  const outcome = result.outcome;
  console.info(`[e2e] ${label}: ${outcome ? `${outcome.result} (${outcome.reason})` : "no outcome"} in round ${result.rounds}, ${result.commands} commands`);
  expect(outcome).not.toBeNull();
  const replayed = replay(result.session.log, CORE_DEPS);
  expect(replayed.ok).toBe(true);
  if (replayed.ok) expect(replayed.state).toEqual(result.session.state);
}

const seats = (...starterDeckIds: readonly string[]) => starterDeckIds.map((starterDeckId) => ({ starterDeckId }));

test("Rhino (standard, Bomb Scare), solo: Spider-Man (Justice)", () => {
  playAndReplay("Rhino (standard) — Spider-Man", coreScenario("rhino", { players: seats("core-spider-man-justice"), seed: 2026 }));
}, 120_000);

test("Rhino (expert, Bomb Scare), solo: Iron Man (Aggression)", () => {
  playAndReplay("Rhino (expert) — Iron Man", coreScenario("rhino", { difficulty: "expert", players: seats("core-iron-man-aggression"), seed: 404 }));
}, 120_000);

test("Klaw (standard, Masters of Evil), 2 players: She-Hulk (Aggression) + Black Panther (Protection)", () => {
  playAndReplay(
    "Klaw (standard) — She-Hulk + Black Panther",
    coreScenario("klaw", { players: seats("core-she-hulk-aggression", "core-black-panther-protection"), seed: 77 }),
  );
}, 120_000);

test("Ultron (standard, Under Attack), 4 players: Captain Marvel, Iron Man, Black Panther, Spider-Man", () => {
  playAndReplay(
    "Ultron (standard) — Captain Marvel + Iron Man + Black Panther + Spider-Man",
    coreScenario("ultron", {
      players: seats("core-captain-marvel-leadership", "core-iron-man-aggression", "core-black-panther-protection", "core-spider-man-justice"),
      seed: 1138,
    }),
  );
}, 180_000);
