import { createGame, replay, type GameState } from "@mc/engine";
import { describe, expect, it } from "vitest";
import { playToOutcome, type DriverResult } from "../../testing/driver.js";
import { firstLegal, patchInstance, settle } from "../../testing/harness.js";
import { WAVE6_DEPS, wave6Scenario, type Wave6ScenarioOptions } from "../index.js";
import { challengersOf, championOf } from "./magog-testing.js";

/**
 * Whole MaGog games, played by the card-name-agnostic greedy driver (`../../testing/driver.ts`) with Core heroes to a
 * real outcome; each session log must replay to the identical final state. The scenario takes one genre modular set.
 */
const SOLO = [{ starterDeckId: "core-spider-man-justice" }] as const;
const DUO = [
  { starterDeckId: "core-spider-man-justice" },
  { starterDeckId: "core-captain-marvel-leadership" },
] as const;

const start = (options: Partial<Wave6ScenarioOptions>, stage: (state: GameState) => GameState = (s) => s) => {
  const config = wave6Scenario("magog", { players: SOLO, seed: 1, firstPlayerIndex: 0, ...options });
  const created = createGame(config, WAVE6_DEPS);
  if (!created.ok) throw new Error(`setup failed: ${created.error.message}`);
  return stage(settle(created.state, firstLegal, (s) => s.step.phase === "player", WAVE6_DEPS));
};

const expectReplays = (result: DriverResult) => {
  const replayed = replay(result.session.log, WAVE6_DEPS);
  expect(replayed.ok).toBe(true);
  if (replayed.ok) expect(replayed.state).toEqual(result.session.state);
};

const ratings = (state: GameState, id: ReturnType<typeof championOf>): number =>
  state.instances[id]!.counters["ratings"] ?? 0;

/** The first of `seeds` whose game ends as `wanted` says; the driver is deterministic, so the same seed is found each run. */
const findGame = (
  seeds: readonly number[],
  build: (seed: number) => GameState,
  wanted: (result: DriverResult) => boolean,
): DriverResult => {
  for (const seed of seeds) {
    const result = playToOutcome(build(seed), WAVE6_DEPS);
    if (wanted(result)) return result;
  }
  throw new Error(`no seed of ${seeds.join(", ")} ended as wanted`);
};

describe("MaGog (standard, one hero)", () => {
  it("is won on The Challengers: the crowd flips at 5, Tag Team brings in Surprise Contender, and 10 ratings counters win", () => {
    // The Challengers start with 4 ratings counters (surgery on the replay baseline), so one real placement flips them.
    const result = findGame(
      Array.from({ length: 30 }, (_, i) => i + 1),
      (seed) =>
        start({ seed, modularSetIds: ["western"] }, (s) =>
          patchInstance(s, challengersOf(s), { counters: { ratings: 4 } }),
        ),
      (r) => r.outcome?.result === "win",
    );
    const end = result.session.state;
    expect(end.instances[challengersOf(end)]!.flipped).toBe(true);
    expect(ratings(end, challengersOf(end))).toBeGreaterThanOrEqual(10);
    expect(ratings(end, championOf(end))).toBeLessThan(10);
    expectReplays(result);
  }, 300_000);

  it("is lost on The Champion: 10 ratings counters there and MaGog wins again", () => {
    const result = findGame(
      Array.from({ length: 20 }, (_, i) => i + 1),
      (seed) => start({ seed, modularSetIds: ["crime"] }),
      (r) => {
        const end = r.session.state;
        return r.outcome?.result === "loss" && ratings(end, championOf(end)) >= 10;
      },
    );
    const end = result.session.state;
    expect(end.instances[championOf(end)]!.flipped).toBe(true);
    expect(ratings(end, challengersOf(end))).toBeLessThan(10);
    expectReplays(result);
  }, 300_000);
});

describe("MaGog (expert and two players)", () => {
  it("an expert game plays to an outcome and replays deep-equal", () => {
    const result = playToOutcome(start({ seed: 7, difficulty: "expert", modularSetIds: ["horror"] }), WAVE6_DEPS);
    expect(result.outcome).not.toBeNull();
    expectReplays(result);
  }, 120_000);

  it("a two-player game plays to an outcome and replays deep-equal", () => {
    const result = playToOutcome(start({ seed: 3, players: DUO, modularSetIds: ["sitcom"] }), WAVE6_DEPS);
    expect(result.outcome).not.toBeNull();
    expect(result.rounds).toBeGreaterThanOrEqual(1);
    expectReplays(result);
  }, 120_000);
});

describe.each(["crime", "fantasy", "horror", "sci-fi", "sitcom", "western"])("MaGog with the %s genre set", (set) => {
  it("plays to an outcome and replays deep-equal", () => {
    const result = playToOutcome(start({ seed: 5, modularSetIds: [set] }), WAVE6_DEPS);
    expect(result.outcome).not.toBeNull();
    expectReplays(result);
  }, 120_000);
});
