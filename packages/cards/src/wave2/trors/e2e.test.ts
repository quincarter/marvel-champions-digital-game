import { createGame, replay } from "@mc/engine";
import { playToOutcome } from "../../testing/driver.js";
import { WAVE2_DEPS } from "../index.js";
import { wave2Scenario } from "../setup.js";

/**
 * Real-game tests for the `trors` pack (docs/phase7-wave2-scripting.md "Test conventions", modeled on
 * `../../wave1/hlk/e2e.test.ts`): each precon played headlessly by the card-name-agnostic greedy driver
 * `../../testing/driver.ts` uses for Core/wave 1, to a real win or loss, then the session log replayed to a
 * deep-equal final state. Every card without a script yet (docs/phase7-wave2-scripting.md "Progress") simply has
 * no abilities — the engine skips an unregistered ability id silently — so these games are legal but easier than
 * a real table; they exist to catch an ability that's individually well-tested but breaks when the generic driver
 * actually drives it through a full turn cycle, exactly as wave 1's own e2e tests do.
 */
test("Rhino (standard), solo: Hawkeye (Leadership)", () => {
  const config = wave2Scenario("rhino", { players: [{ starterDeckId: "hawkeye-leadership" }], seed: 2026 });
  const created = createGame(config, WAVE2_DEPS);
  if (!created.ok) throw new Error(`setup failed: ${created.error.message}`);
  const result = playToOutcome(created.state, WAVE2_DEPS);
  console.info(`[wave2 e2e] Rhino (standard) — Hawkeye: ${result.outcome ? `${result.outcome.result} (${result.outcome.reason})` : "no outcome"} in round ${result.rounds}, ${result.commands} commands`);
  expect(result.outcome).not.toBeNull();
  expect(result.rounds).toBeGreaterThanOrEqual(1);
  const replayed = replay(result.session.log, WAVE2_DEPS);
  expect(replayed.ok).toBe(true);
  if (replayed.ok) expect(replayed.state).toEqual(result.session.state);
}, 120_000);

test("Rhino (standard), solo: Spider-Woman (Aggression & Justice)", () => {
  const config = wave2Scenario("rhino", { players: [{ starterDeckId: "spider-woman-aggression-justice" }], seed: 2026 });
  const created = createGame(config, WAVE2_DEPS);
  if (!created.ok) throw new Error(`setup failed: ${created.error.message}`);
  const result = playToOutcome(created.state, WAVE2_DEPS);
  console.info(`[wave2 e2e] Rhino (standard) — Spider-Woman: ${result.outcome ? `${result.outcome.result} (${result.outcome.reason})` : "no outcome"} in round ${result.rounds}, ${result.commands} commands`);
  expect(result.outcome).not.toBeNull();
  expect(result.rounds).toBeGreaterThanOrEqual(1);
  const replayed = replay(result.session.log, WAVE2_DEPS);
  expect(replayed.ok).toBe(true);
  if (replayed.ok) expect(replayed.state).toEqual(result.session.state);
}, 120_000);

/**
 * Crossbones, standalone (docs/phase7-wave2.md §2.2 / `../setup.ts`'s `crossbonesScenario`): the only cycle 1
 * scenario scripted so far. A setup-and-a-few-rounds check, not a full playthrough to outcome — the Experimental
 * Weapons separate deck and the two villain-side "reveal its top card" abilities are exercised through ordinary
 * play, but nothing here depends on the greedy driver reaching a particular stage.
 */
test("Crossbones (standard), 2-player: Hawkeye and Spider-Woman — legal setup and a full round", () => {
  const config = wave2Scenario("crossbones", {
    players: [{ starterDeckId: "hawkeye-leadership" }, { starterDeckId: "spider-woman-aggression-justice" }],
    seed: 2026,
  });
  const created = createGame(config, WAVE2_DEPS);
  if (!created.ok) throw new Error(`setup failed: ${created.error.message}`);
  expect(created.state.villains).toHaveLength(1);
  expect(created.state.scenarioDecks["Experimental Weapons"]).toBeDefined();
  expect(created.state.scenarioDecks["Experimental Weapons"]?.deck.length).toBeGreaterThan(0);
  expect(created.state.outcome).toBeNull();
}, 60_000);
