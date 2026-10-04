/**
 * Rules-QA 2026-10-03: a seeded soak of every wave 6 hero precon against every wave 6 scenario, played by the greedy
 * driver (`../testing/driver.ts`, which knows no card names) for a few rounds each.
 *
 * Per game it asserts what the 2026-10-03 engine changes could have broken wholesale:
 * - every command the driver issues is accepted and nothing throws (the driver throws on a rejected command, which is
 *   also what a pending choice with no legal answer looks like);
 * - no stuck state: a pending choice always offers at least as many options as it needs;
 * - the session log replays from the seed to a deep-equal state;
 * - no game ends with `encounterDeckExhausted` before round 3 (Q57, RRG 1.8 p. 17, would be firing too eagerly: three
 *   rounds of a 1-4 card deal never empties a real scenario's deck and discard pile together).
 *
 * Matrix. By default a representative set of 13 games that finishes in about a minute on an idle machine: the diagonal
 * (hero i against scenario i, solo, standard: 8 games), three two-player games (hero i with hero i+1 for i = 0, 3, 6)
 * and two expert games (i = 1, 5).
 * `QA_SOAK_FULL=1` runs the full 8 x 8 solo standard matrix plus the two-player and expert diagonals of every offset
 * (hero i against scenario i + k): `QA_SOAK_FULL=1 pnpm --filter @mc/cards exec vitest run src/wave6/qa-soak-2026-10-03.test.ts`.
 * Rounds are bounded by a command cap (about ten commands a round), not by the clock, so the run is deterministic.
 */
import { WAVE6_SCENARIOS, WAVE6_STARTER_DECKS } from "@mc/content";
import { createGame, replay, type GameState } from "@mc/engine";
import { describe, expect, it } from "vitest";
import { playToOutcome } from "../testing/driver.js";
import { WAVE6_DEPS, wave6Scenario } from "./index.js";

const FULL =
  (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env?.QA_SOAK_FULL === "1";
const HEROES = WAVE6_STARTER_DECKS.map((deck) => deck.id as string);
const SCENARIOS = WAVE6_SCENARIOS.map((scenario) => scenario.id as string);
/** About three rounds of one greedy player's turns (it plays, uses abilities and ends its turn); per seated player. */
const COMMAND_CAP = 45;
const TIMEOUT = 180_000;

interface Game {
  readonly hero: string;
  readonly scenario: string;
  readonly also?: string;
  readonly expert?: boolean;
}
const label = (g: Game) => `${g.hero}${g.also ? ` + ${g.also}` : ""} vs ${g.scenario}${g.expert ? " (expert)" : ""}`;
const seedOf = (h: number, s: number, extra = 0) => 100 + h * 8 + s + extra * 1000;

function matrix(): readonly Game[] {
  const games: Game[] = [];
  if (FULL) {
    for (let h = 0; h < HEROES.length; h++)
      for (let s = 0; s < SCENARIOS.length; s++) games.push({ hero: HEROES[h]!, scenario: SCENARIOS[s]! });
    for (let k = 0; k < SCENARIOS.length; k++)
      for (let h = 0; h < HEROES.length; h++) {
        games.push({
          hero: HEROES[h]!,
          also: HEROES[(h + 1 + (k % 7)) % HEROES.length]!,
          scenario: SCENARIOS[(h + k) % SCENARIOS.length]!,
        });
        games.push({ hero: HEROES[h]!, scenario: SCENARIOS[(h + k + 3) % SCENARIOS.length]!, expert: true });
      }
    return games;
  }
  for (let h = 0; h < HEROES.length; h++) {
    games.push({ hero: HEROES[h]!, scenario: SCENARIOS[h]! });
    // Every third hero also seats the next one (3 two-player games); every fourth plays expert (2 expert games).
    if (h % 3 === 0)
      games.push({
        hero: HEROES[h]!,
        also: HEROES[(h + 1) % HEROES.length]!,
        scenario: SCENARIOS[(h + 1) % SCENARIOS.length]!,
      });
    if (h % 4 === 1) games.push({ hero: HEROES[h]!, scenario: SCENARIOS[(h + 3) % SCENARIOS.length]!, expert: true });
  }
  return games;
}

function play(game: Game, seed: number): { readonly state: GameState; readonly rounds: number } {
  const players = [{ starterDeckId: game.hero }, ...(game.also ? [{ starterDeckId: game.also }] : [])];
  const created = createGame(
    wave6Scenario(game.scenario, { players, seed, ...(game.expert ? { difficulty: "expert" as const } : {}) }),
    WAVE6_DEPS,
  );
  if (!created.ok) throw new Error(`setup failed: ${created.error.message}`);
  const result = playToOutcome(created.state, WAVE6_DEPS, { maxCommands: COMMAND_CAP * players.length });
  const replayed = replay(result.session.log, WAVE6_DEPS);
  if (!replayed.ok) throw new Error(`replay failed: ${replayed.error.message}`);
  expect(replayed.state).toEqual(result.session.state);
  const choice = result.session.state.pendingChoice;
  if (choice)
    expect(choice.options.length, "a pending choice with too few options").toBeGreaterThanOrEqual(choice.minSelections);
  return { state: result.session.state, rounds: result.rounds };
}

describe(`wave 6 seeded soak (${FULL ? "full matrix" : "representative matrix; QA_SOAK_FULL=1 for all"})`, () => {
  const games = matrix();
  it("has the matrix it says it has", () => {
    expect(HEROES).toHaveLength(8);
    expect(SCENARIOS).toHaveLength(8);
    expect(games.length).toBe(FULL ? 64 + 64 + 64 : 8 + 3 + 2);
  });
  games.forEach((game, index) => {
    it(
      `${label(game)}`,
      () => {
        const { state, rounds } = play(
          game,
          seedOf(HEROES.indexOf(game.hero), SCENARIOS.indexOf(game.scenario), game.also ? 1 : game.expert ? 2 : 0) +
            index,
        );
        const outcome = state.outcome;
        if (outcome?.result === "loss" && outcome.reason === "encounterDeckExhausted") {
          expect(
            rounds,
            `encounterDeckExhausted at round ${rounds}: the both-empty rule is firing too eagerly`,
          ).toBeGreaterThanOrEqual(3);
        }
        // The run did something: it reached round 3 or ended.
        expect(outcome !== null || rounds >= 3, `stopped at round ${rounds} with no outcome`).toBe(true);
      },
      TIMEOUT,
    );
  });
});
