/**
 * Rules-QA 2026-10-04: a seeded soak of modular encounter sets inside scenarios they were never printed for
 * (owner decision of 2026-10-04, RRG 1.8 "Modular Encounter Set", p. 29), played by the greedy driver
 * (`./testing/driver.ts`, which knows no card names) for about three rounds each.
 *
 * Per game it asserts:
 * - the pairing builds (through `playableScenario`), and every
 *   command the driver issues is accepted (the driver throws on a rejected command, which is also what a pending
 *   choice with no legal answer looks like);
 * - no stuck state: a pending choice always offers at least as many options as it needs;
 * - the session log replays from the seed to a deep-equal state;
 * - no game ends with `encounterDeckExhausted` before round 3 (RRG 1.8 p. 17; three rounds never empty a real deck and
 *   its discard pile together). A loss by a card ability is allowed and counted (Sabretooth prints its own: Robert Kelly
 *   leaving play, Stalked by Sabretooth); the full run reports them by scenario.
 *
 * Matrix. Default: a rotating sample of two games per modular set (70 sets), the scenario chosen each time as the
 * eligible one used least so far, so every set meets two scenarios and every scenario that takes a modular set is
 * hit at least twice (asserted). One game in five is expert, one in seven has two players. Finishes in about a minute
 * on an idle machine. `QA_MODULAR_FULL=1` plays every buildable pairing solo and standard, and a rotating tenth of
 * them again with two players and expert:
 * `QA_MODULAR_FULL=1 pnpm --filter @mc/cards exec vitest run src/modular-matrix-soak.test.ts`.
 * Rounds are bounded by a command cap (about ten commands a round), not by the clock, so the run is deterministic.
 */
import { createGame, replay, type GameOutcome } from "@mc/engine";
import { afterAll, describe, expect, it } from "vitest";
import { PLAYABLE_DEPS } from "./playable/index.js";
import { playToOutcome } from "./testing/driver.js";
import { MATRIX_HEROES, MODULAR_SETS, PLAYABLE_SCENARIOS, buildPairing, pairingFor } from "./testing/modular-matrix.js";

const FULL =
  (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env?.QA_MODULAR_FULL === "1";
/** About three rounds of one greedy player's turns (two and a half in the default sample, to stay near 90 s); per seated player. */
const COMMAND_CAP = FULL ? 36 : 30;
const TIMEOUT = 60_000;
const FULL_TIMEOUT = 900_000;
/** `QA_MODULAR_ONLY=sabretooth,ronan-the-accuser`: play only these scenarios (a re-run of a failure, a quick look). */
const ONLY = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env?.QA_MODULAR_ONLY;

interface Game {
  readonly set: string;
  readonly scenario: string;
  readonly scenarioIndex: number;
  readonly seats: readonly string[];
  readonly expert: boolean;
  readonly seed: number;
}
const label = (g: Game) =>
  `${g.set} in ${g.scenario}${g.seats.length > 1 ? " (2 players)" : ""}${g.expert ? " (expert)" : ""}`;

const SCENARIO_IDS = PLAYABLE_SCENARIOS.map((scenario) => scenario.id as string);
/** Scenarios eligible for `set`: the pairing builds (not restricted, not the scenario's own required set). */
const eligible = (set: string): readonly number[] =>
  PLAYABLE_SCENARIOS.flatMap((scenario, index) => (pairingFor(set, scenario).kind === "build" ? [index] : []));

function game(set: string, scenarioIndex: number, serial: number, twoPlayers: boolean, expert: boolean): Game {
  const hero = MATRIX_HEROES[serial % MATRIX_HEROES.length]!;
  const also = MATRIX_HEROES[(serial + 5) % MATRIX_HEROES.length]!;
  return {
    set,
    scenario: SCENARIO_IDS[scenarioIndex]!,
    scenarioIndex,
    seats: twoPlayers ? [hero, also] : [hero],
    expert,
    seed: 7000 + serial,
  };
}

function sample(): readonly Game[] {
  const games: Game[] = [];
  const used = new Map<number, number>();
  let serial = 0;
  for (let pass = 0; pass < 2; pass++)
    MODULAR_SETS.forEach((set, setIndex) => {
      const options = eligible(set.id);
      const least = Math.min(...options.map((index) => used.get(index) ?? 0));
      const fewest = options.filter((index) => (used.get(index) ?? 0) === least);
      const scenarioIndex = fewest[(setIndex * 7 + pass * 3) % fewest.length]!;
      used.set(scenarioIndex, (used.get(scenarioIndex) ?? 0) + 1);
      games.push(game(set.id, scenarioIndex, serial, serial % 7 === 3, serial % 5 === 2));
      serial++;
    });
  return games;
}

function fullMatrix(): readonly Game[] {
  const games: Game[] = [];
  let serial = 0;
  PLAYABLE_SCENARIOS.forEach((scenario, scenarioIndex) =>
    MODULAR_SETS.forEach((set) => {
      if (pairingFor(set.id, scenario).kind !== "build") return;
      games.push(game(set.id, scenarioIndex, serial, false, false));
      if (serial % 10 === 0) games.push(game(set.id, scenarioIndex, serial + 1, true, serial % 20 === 0));
      serial += 2;
    }),
  );
  return games;
}

interface Result {
  readonly game: Game;
  readonly rounds: number;
  readonly commands: number;
  readonly outcome: GameOutcome | null;
  /** The card whose text lost the game, by name (`loss:cardAbility`). */
  readonly lossSource?: string;
}
const results: Result[] = [];

function play(g: Game): Result {
  const scenario = PLAYABLE_SCENARIOS[g.scenarioIndex]!;
  const built = buildPairing(g.set, scenario, {
    seed: g.seed,
    players: g.seats.map((starterDeckId) => ({ starterDeckId })),
    expert: g.expert,
  });
  const config = built.config;
  if (!config) throw new Error(`${label(g)} does not build: ${built.error ?? built.pairing.kind}`);
  const created = createGame(config, PLAYABLE_DEPS);
  if (!created.ok) throw new Error(`setup failed: ${created.error.message}`);
  const run = playToOutcome(created.state, PLAYABLE_DEPS, { maxCommands: COMMAND_CAP * g.seats.length });
  const replayed = replay(run.session.log, PLAYABLE_DEPS);
  if (!replayed.ok) throw new Error(`replay failed: ${replayed.error.message}`);
  expect(replayed.state, "replay from the seed diverged").toEqual(run.session.state);
  const choice = run.session.state.pendingChoice;
  if (choice)
    expect(choice.options.length, "a pending choice with too few options").toBeGreaterThanOrEqual(choice.minSelections);
  const source =
    run.outcome?.result === "loss" && run.outcome.reason === "cardAbility" ? run.outcome.sourceInstanceId : undefined;
  const lossSource = source ? run.session.state.cardPool[run.session.state.instances[source]!.cardId]?.name : undefined;
  const result: Result = {
    game: g,
    rounds: run.rounds,
    commands: run.commands,
    outcome: run.outcome,
    ...(lossSource ? { lossSource } : {}),
  };
  results.push(result);
  return result;
}

function check(r: Result): void {
  const { outcome, rounds } = r;
  if (outcome?.result === "loss" && outcome.reason === "encounterDeckExhausted")
    expect(
      rounds,
      `encounterDeckExhausted at round ${rounds}: the both-empty rule is firing too eagerly`,
    ).toBeGreaterThanOrEqual(3);
  // Progress: a greedy turn can use a dozen commands, so 36 of them may be only two rounds; stuck is round 1.
  expect(
    outcome !== null || rounds >= 2,
    `stopped at round ${rounds} after ${r.commands} commands with no outcome`,
  ).toBe(true);
}

describe(`modular set soak (${FULL ? "full matrix" : "rotating sample; QA_MODULAR_FULL=1 for all"})`, () => {
  afterAll(() => {
    if (!FULL) return;
    const reasons: Record<string, number> = {};
    for (const { outcome } of results) {
      const key = outcome ? `${outcome.result}:${outcome.reason}` : "unfinished";
      reasons[key] = (reasons[key] ?? 0) + 1;
    }
    console.log(`modular soak: ${results.length} games`, reasons);
    const losses: Record<string, number> = {};
    for (const r of results) {
      if (r.outcome?.result !== "loss" || r.outcome.reason !== "cardAbility") continue;
      const key = `${r.game.scenario}: ${r.lossSource ?? "no source card"}`;
      losses[key] = (losses[key] ?? 0) + 1;
    }
    console.log("losses by a card ability", losses);
  });

  if (!FULL) {
    const games = sample();
    it("has the sample it says it has: every set twice, every scenario that takes a modular set at least twice", () => {
      expect(games).toHaveLength(MODULAR_SETS.length * 2);
      for (const set of MODULAR_SETS)
        expect(games.filter((g) => g.set === set.id).length, `${set.id} games`).toBeGreaterThanOrEqual(2);
      const takers = PLAYABLE_SCENARIOS.filter((scenario) =>
        MODULAR_SETS.some((set) => pairingFor(set.id, scenario).kind === "build"),
      );
      expect(takers.map((scenario) => scenario.id)).toHaveLength(38);
      for (const scenario of takers)
        expect(games.filter((g) => g.scenario === scenario.id).length, `${scenario.id} games`).toBeGreaterThanOrEqual(
          2,
        );
      // The restricted scenarios (Breakout, The Hood, Sinister Six) take no modular set: soaked by their own tests.
      expect(
        PLAYABLE_SCENARIOS.filter((scenario) => !takers.includes(scenario)).map((scenario) => scenario.id),
      ).toEqual(["breakout", "the-hood", "sinister-six"]);
      expect(games.some((g) => g.expert)).toBe(true);
      expect(games.some((g) => g.seats.length === 2)).toBe(true);
    });
    games.forEach((g) => {
      it(label(g), () => check(play(g)), TIMEOUT);
    });
  } else {
    // One test per scenario keeps the reporter readable; a failing game names itself in the thrown message.
    const games = fullMatrix();
    PLAYABLE_SCENARIOS.forEach((scenario) => {
      if (ONLY && !ONLY.split(",").includes(scenario.id)) return;
      const mine = games.filter((g) => g.scenario === scenario.id);
      if (mine.length === 0) return;
      it(
        `${scenario.id}: ${mine.length} games`,
        () => {
          const failures: string[] = [];
          for (const g of mine) {
            try {
              check(play(g));
            } catch (error) {
              failures.push(`${label(g)}: ${(error as Error).message.split("\n")[0]}`);
            }
          }
          expect(failures).toEqual([]);
        },
        FULL_TIMEOUT,
      );
    });
  }
});
