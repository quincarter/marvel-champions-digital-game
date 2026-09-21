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
  console.info(
    `[wave2 e2e] Rhino (standard) — Hawkeye: ${result.outcome ? `${result.outcome.result} (${result.outcome.reason})` : "no outcome"} in round ${result.rounds}, ${result.commands} commands`,
  );
  expect(result.outcome).not.toBeNull();
  expect(result.rounds).toBeGreaterThanOrEqual(1);
  const replayed = replay(result.session.log, WAVE2_DEPS);
  expect(replayed.ok).toBe(true);
  if (replayed.ok) expect(replayed.state).toEqual(result.session.state);
}, 120_000);

test("Rhino (standard), solo: Spider-Woman (Aggression & Justice)", () => {
  const config = wave2Scenario("rhino", {
    players: [{ starterDeckId: "spider-woman-aggression-justice" }],
    seed: 2026,
  });
  const created = createGame(config, WAVE2_DEPS);
  if (!created.ok) throw new Error(`setup failed: ${created.error.message}`);
  const result = playToOutcome(created.state, WAVE2_DEPS);
  console.info(
    `[wave2 e2e] Rhino (standard) — Spider-Woman: ${result.outcome ? `${result.outcome.result} (${result.outcome.reason})` : "no outcome"} in round ${result.rounds}, ${result.commands} commands`,
  );
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

/**
 * All five `trors` scenarios played to a real win or loss (rules-qa-engineer wave 2 pass, task item 1): before this,
 * only Rhino (a Core scenario) had ever been driven to outcome with wave 2 content, and Crossbones only had the
 * "legal setup and a full round" check above — Absorbing Man, Taskmaster, Zola and Red Skull had never been played
 * end to end by anything but hand-written ability tests. Each of these exercises that scenario's own setup
 * (`SETASIDE_BY_SCENARIO`, `separateDecks`), its full villain stage sequence, and every encounter set in its
 * `recommendedModularSetIds`, and replays the session log to a deep-equal final state.
 */
describe("every trors scenario reaches an outcome (standard, solo)", () => {
  // Crossbones (standard, solo, seed 3001) is a known BLOCKER, not skipped here — see `qa.test.ts`'s
  // `test.fails` for the full repro and citation (a card-script bug in 04146 "Hydra Jet-Trooper"'s Boost ability,
  // `hydra_assault` modular set — missing "do not deal any boost cards for that attack" — which also threatens
  // Red Skull, the other scenario recommending `hydra_assault`; `ability-scripting-engineer` owns the fix). Left
  // out of this `describe` (rather than added as a `test.fails` here too) so this block's shape stays "every
  // scenario reaches an outcome, full stop" and the one exception lives in exactly one place.

  test("Absorbing Man (standard), solo: Spider-Woman (Aggression & Justice)", () => {
    const config = wave2Scenario("absorbing-man", {
      players: [{ starterDeckId: "spider-woman-aggression-justice" }],
      seed: 3002,
    });
    const created = createGame(config, WAVE2_DEPS);
    if (!created.ok) throw new Error(`setup failed: ${created.error.message}`);
    const result = playToOutcome(created.state, WAVE2_DEPS);
    console.info(
      `[wave2 e2e] Absorbing Man (standard, solo) — Spider-Woman: ${result.outcome ? `${result.outcome.result} (${result.outcome.reason})` : "no outcome"} in round ${result.rounds}, ${result.commands} commands`,
    );
    expect(result.outcome).not.toBeNull();
    expect(result.rounds).toBeGreaterThanOrEqual(1);
    const replayed = replay(result.session.log, WAVE2_DEPS);
    expect(replayed.ok).toBe(true);
    if (replayed.ok) expect(replayed.state).toEqual(result.session.state);
  }, 120_000);

  test("Taskmaster (standard), solo: Hawkeye (Leadership)", () => {
    const config = wave2Scenario("taskmaster", { players: [{ starterDeckId: "hawkeye-leadership" }], seed: 3003 });
    const created = createGame(config, WAVE2_DEPS);
    if (!created.ok) throw new Error(`setup failed: ${created.error.message}`);
    const result = playToOutcome(created.state, WAVE2_DEPS);
    console.info(
      `[wave2 e2e] Taskmaster (standard, solo) — Hawkeye: ${result.outcome ? `${result.outcome.result} (${result.outcome.reason})` : "no outcome"} in round ${result.rounds}, ${result.commands} commands`,
    );
    expect(result.outcome).not.toBeNull();
    expect(result.rounds).toBeGreaterThanOrEqual(1);
    const replayed = replay(result.session.log, WAVE2_DEPS);
    expect(replayed.ok).toBe(true);
    if (replayed.ok) expect(replayed.state).toEqual(result.session.state);
  }, 120_000);

  test("Zola (standard), solo: Spider-Woman (Aggression & Justice)", () => {
    const config = wave2Scenario("zola", {
      players: [{ starterDeckId: "spider-woman-aggression-justice" }],
      seed: 3004,
    });
    const created = createGame(config, WAVE2_DEPS);
    if (!created.ok) throw new Error(`setup failed: ${created.error.message}`);
    const result = playToOutcome(created.state, WAVE2_DEPS);
    console.info(
      `[wave2 e2e] Zola (standard, solo) — Spider-Woman: ${result.outcome ? `${result.outcome.result} (${result.outcome.reason})` : "no outcome"} in round ${result.rounds}, ${result.commands} commands`,
    );
    expect(result.outcome).not.toBeNull();
    expect(result.rounds).toBeGreaterThanOrEqual(1);
    const replayed = replay(result.session.log, WAVE2_DEPS);
    expect(replayed.ok).toBe(true);
    if (replayed.ok) expect(replayed.state).toEqual(result.session.state);
  }, 120_000);

  test("Red Skull (standard), solo: Hawkeye (Leadership)", () => {
    const config = wave2Scenario("red-skull", { players: [{ starterDeckId: "hawkeye-leadership" }], seed: 3005 });
    const created = createGame(config, WAVE2_DEPS);
    if (!created.ok) throw new Error(`setup failed: ${created.error.message}`);
    const result = playToOutcome(created.state, WAVE2_DEPS);
    console.info(
      `[wave2 e2e] Red Skull (standard, solo) — Hawkeye: ${result.outcome ? `${result.outcome.result} (${result.outcome.reason})` : "no outcome"} in round ${result.rounds}, ${result.commands} commands`,
    );
    expect(result.outcome).not.toBeNull();
    expect(result.rounds).toBeGreaterThanOrEqual(1);
    const replayed = replay(result.session.log, WAVE2_DEPS);
    expect(replayed.ok).toBe(true);
    if (replayed.ok) expect(replayed.state).toEqual(result.session.state);
  }, 120_000);
});

/**
 * A 2-player game reaching outcome, for at least one trors scenario (task item 1's multiplayer requirement):
 * exercises indirect damage assignment and per-player encounter dealing against real cycle 1 content (the Rhino
 * 2-player games above only ever exercised Core's own encounter set).
 */
test("Crossbones (standard), 2-player: Hawkeye and Spider-Woman — outcome", () => {
  const config = wave2Scenario("crossbones", {
    players: [{ starterDeckId: "hawkeye-leadership" }, { starterDeckId: "spider-woman-aggression-justice" }],
    seed: 3006,
  });
  const created = createGame(config, WAVE2_DEPS);
  if (!created.ok) throw new Error(`setup failed: ${created.error.message}`);
  const result = playToOutcome(created.state, WAVE2_DEPS);
  console.info(
    `[wave2 e2e] Crossbones (standard, 2-player) — Hawkeye/Spider-Woman: ${result.outcome ? `${result.outcome.result} (${result.outcome.reason})` : "no outcome"} in round ${result.rounds}, ${result.commands} commands`,
  );
  expect(result.outcome).not.toBeNull();
  expect(result.rounds).toBeGreaterThanOrEqual(1);
  const replayed = replay(result.session.log, WAVE2_DEPS);
  expect(replayed.ok).toBe(true);
  if (replayed.ok) expect(replayed.state).toEqual(result.session.state);
}, 120_000);

/**
 * Expert difficulty, kept to the cheapest trors scenario to run (Absorbing Man has no separate decks and one
 * encounter set beyond `standard`/`expert`): proves `villainStages.expert` (`[2, 3]`, i.e. expert games start on
 * the villain's stage 2, docs/phase7-wave2.md §2.2) actually resolves through both remaining stages to an outcome.
 */
test("Absorbing Man (expert), solo: Hawkeye (Leadership)", () => {
  const config = wave2Scenario("absorbing-man", {
    players: [{ starterDeckId: "hawkeye-leadership" }],
    difficulty: "expert",
    seed: 3007,
  });
  const created = createGame(config, WAVE2_DEPS);
  if (!created.ok) throw new Error(`setup failed: ${created.error.message}`);
  const result = playToOutcome(created.state, WAVE2_DEPS);
  console.info(
    `[wave2 e2e] Absorbing Man (expert, solo) — Hawkeye: ${result.outcome ? `${result.outcome.result} (${result.outcome.reason})` : "no outcome"} in round ${result.rounds}, ${result.commands} commands`,
  );
  expect(result.outcome).not.toBeNull();
  expect(result.rounds).toBeGreaterThanOrEqual(1);
  const replayed = replay(result.session.log, WAVE2_DEPS);
  expect(replayed.ok).toBe(true);
  if (replayed.ok) expect(replayed.state).toEqual(result.session.state);
}, 120_000);
