import { createGame, replay, type GameEvent, type GameState } from "@mc/engine";
import { describe, expect, it } from "vitest";
import { playToOutcome, type DriverResult } from "../../testing/driver.js";
import { firstLegal, patchInstance, settle } from "../../testing/harness.js";
import { WAVE6_DEPS, wave6Scenario, type Wave6ScenarioOptions } from "../index.js";
import {
  mojoOf,
  setAsideSets,
  wheelOf,
  withMojoStage,
  withNoSetAside,
  withShrunkEncounterDeck,
} from "./mojo-testing.js";

/**
 * Whole Mojo games, played by the card-name-agnostic greedy driver (`../../testing/driver.ts`) with Core heroes to a
 * real outcome; each session log must replay to the identical final state. Games whose starting state is staged by
 * surgery say so where they are built.
 */
const SOLO = [{ starterDeckId: "core-spider-man-justice" }] as const;
const DUO = [
  { starterDeckId: "core-spider-man-justice" },
  { starterDeckId: "core-captain-marvel-leadership" },
] as const;

const start = (options: Partial<Wave6ScenarioOptions>, stage: (state: GameState) => GameState = (s) => s) => {
  const config = wave6Scenario("mojo", { players: SOLO, seed: 1, firstPlayerIndex: 0, ...options });
  const created = createGame(config, WAVE6_DEPS);
  if (!created.ok) throw new Error(`setup failed: ${created.error.message}`);
  return stage(settle(created.state, firstLegal, (s) => s.step.phase === "player", WAVE6_DEPS));
};

/** The replay of the session's log: it must reach the identical final state. Returns the events. */
const replayed = (result: DriverResult): readonly GameEvent[] => {
  const again = replay(result.session.log, WAVE6_DEPS);
  expect(again.ok).toBe(true);
  if (!again.ok) throw new Error("replay failed");
  expect(again.state).toEqual(result.session.state);
  return again.events;
};

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
const seeds = (n: number) => Array.from({ length: n }, (_, i) => i + 1);

const mainThreat = (state: GameState): number => state.instances[state.mainScheme.instanceId]!.threat;
/** MojoMania's target threat: 25 per hero. */
const TARGET_PER_HERO = 25;
const resetsIn = (events: readonly GameEvent[]) => events.filter((e) => e.type === "accelerationTokenAdded").length;
const flipsOf = (events: readonly GameEvent[], id: string) =>
  events.filter((e) => e.type === "cardFlipped" && e.instanceId === id).length;

describe("Mojo (standard, one hero)", () => {
  it("is lost to the main scheme: MojoMania is completed", () => {
    const result = findGame(
      seeds(20),
      (seed) => start({ seed }),
      (r) => r.outcome?.result === "loss" && mainThreat(r.session.state) >= TARGET_PER_HERO,
    );
    expect(result.outcome).toEqual({ result: "loss", reason: "mainSchemeCompleted" });
    replayed(result);
  }, 300_000);

  it("is lost to the Wheel of Genres: the encounter deck resets with no set-aside modular set left", () => {
    // Staged by surgery: no genre set is left set aside, and the encounter deck is 3 cards (the rest removed), so the
    // first reset comes in the first round. Everything after that is played by the driver.
    const state = start({ seed: 2 }, (s) => withNoSetAside(withShrunkEncounterDeck(s, 3)));
    const wheel = wheelOf(state);
    const result = playToOutcome(state, WAVE6_DEPS);
    expect(result.outcome?.result).toBe("loss");
    const end = result.session.state;
    // Not the main scheme: it never reached its target, and the Wheel never flipped (the loss came first).
    expect(mainThreat(end)).toBeLessThan(TARGET_PER_HERO);
    const events = replayed(result);
    expect(resetsIn(events)).toBeGreaterThanOrEqual(1);
    expect(flipsOf(events, wheel)).toBe(0);
    expect(setAsideSets(end)).toEqual([]);
  }, 300_000);

  it("is won: Mojo II (the last standard stage) is defeated", () => {
    // Staged by surgery: Mojo is at stage II one hit point from defeat (18 hit points, 17 damage); the greedy driver
    // cannot get through both of Mojo's stages on its own. The Wheel, the set-aside sets and the threat on the hero
    // are all played, not staged.
    const result = findGame(
      seeds(10),
      (seed) =>
        start({ seed }, (s) => {
          const second = withMojoStage(s, 1);
          return patchInstance(second, mojoOf(second), { damage: 17 });
        }),
      (r) => r.outcome?.result === "win",
    );
    expect(result.outcome).toEqual({ result: "win", reason: "villainDefeated" });
    const end = result.session.state;
    expect(end.villains.find((v) => v.instanceId === mojoOf(end))!.defeated).toBe(true);
    replayed(result);
  }, 300_000);

  it("resets the encounter deck twice: a Wheel flip, a set placed on top of the deck, a second reset", () => {
    // Staged by surgery: the encounter deck is cut to 6 cards (the rest removed from the game) so that two resets
    // fall inside a game of a few rounds. The first reset flips the Wheel, the next step three brings a set in, shuffled
    // on top; the second reset (the Wheel SPINNING again) is the one that ends the game or flips it once more.
    const wanted = (r: DriverResult): boolean => {
      const again = replay(r.session.log, WAVE6_DEPS);
      if (!again.ok) return false;
      return (
        resetsIn(again.events) >= 2 &&
        again.events.some((e) => e.type === "setAsideModularSetShuffledIn" && e.placement === "shuffledOnTop")
      );
    };
    const result = findGame(seeds(16), (seed) => start({ seed }, (s) => withShrunkEncounterDeck(s, 6)), wanted);
    const events = replayed(result);
    expect(resetsIn(events)).toBeGreaterThanOrEqual(2);
    const onTop = events.filter((e) => e.type === "setAsideModularSetShuffledIn" && e.placement === "shuffledOnTop");
    expect(onTop.length).toBeGreaterThanOrEqual(1);
    // The reset that flipped the Wheel came before the set was brought in on top.
    const firstReset = events.findIndex((e) => e.type === "accelerationTokenAdded");
    const brought = events.findIndex(
      (e) => e.type === "setAsideModularSetShuffledIn" && e.placement === "shuffledOnTop",
    );
    expect(firstReset).toBeGreaterThanOrEqual(0);
    expect(brought).toBeGreaterThan(firstReset);
    expect(result.outcome).not.toBeNull();
  }, 300_000);
});

describe("Mojo (expert and two players)", () => {
  it("an expert game (Mojo II then III) plays to an outcome and replays deep-equal", () => {
    const result = playToOutcome(start({ seed: 7, difficulty: "expert" }), WAVE6_DEPS);
    expect(result.outcome).not.toBeNull();
    replayed(result);
  }, 120_000);

  it("a two-player game plays to an outcome and replays deep-equal", () => {
    const result = playToOutcome(start({ seed: 3, players: DUO }), WAVE6_DEPS);
    expect(result.outcome).not.toBeNull();
    expect(result.rounds).toBeGreaterThanOrEqual(1);
    replayed(result);
  }, 120_000);
});
