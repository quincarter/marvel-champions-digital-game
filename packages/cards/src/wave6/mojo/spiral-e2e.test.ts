import { createGame, replay, type GameEvent, type GameState } from "@mc/engine";
import { describe, expect, it } from "vitest";
import { playToOutcome, type DriverResult } from "../../testing/driver.js";
import { firstLegal, patchInstance, settle } from "../../testing/harness.js";
import { WAVE6_DEPS, wave6Scenario, type Wave6ScenarioOptions } from "../index.js";
import { GENRE_SETS, inPlay, spiralOf, withSpiral } from "./spiral-testing.js";

/**
 * Whole Spiral games, played by the card-name-agnostic greedy driver (`../../testing/driver.ts`) with Core heroes to a
 * real outcome; each session log must replay to the identical final state. Three genre sets are always in the deck.
 *
 * The greedy driver spends The Search for Spiral's Hero Action (2 damage as a cost) every turn, so it loses on its own,
 * usually after Cornered! has come up; it never wins unaided, because Spiral cannot be damaged while ESCAPED.
 */
const SOLO = [{ starterDeckId: "core-spider-man-justice" }] as const;
const DUO = [
  { starterDeckId: "core-spider-man-justice" },
  { starterDeckId: "core-captain-marvel-leadership" },
] as const;

const start = (options: Partial<Wave6ScenarioOptions>, stage: (state: GameState) => GameState = (s) => s) => {
  const config = wave6Scenario("spiral", {
    players: SOLO,
    seed: 1,
    firstPlayerIndex: 0,
    modularSetIds: [...GENRE_SETS],
    ...options,
  });
  const created = createGame(config, WAVE6_DEPS);
  if (!created.ok) throw new Error(`setup failed: ${created.error.message}`);
  return stage(settle(created.state, firstLegal, (s) => s.step.phase === "player", WAVE6_DEPS));
};

const replayed = (result: DriverResult) => {
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

/** Whether the log shows Cornered! revealed and a SHOW environment sent to the bottom of the show deck. */
const exercisedShowDeck = (state: GameState, events: readonly GameEvent[]): boolean => {
  const code = (id: string) => state.instances[id as never]?.cardId as string | undefined;
  const cornered = events.some((e) => e.type === "encounterCardRevealed" && e.cardId === "39017");
  const toBottom = events.some(
    (e) =>
      e.type === "cardMoved" &&
      e.to.kind === "scenarioDeck" &&
      ["39035", "39053", "39066"].includes(code(e.instanceId) ?? ""),
  );
  return cornered && toBottom;
};

describe("Spiral (standard, one hero)", () => {
  it("is lost: the hero falls after Cornered! flipped Spiral and a SHOW went to the bottom of the show deck", () => {
    const result = findGame(
      Array.from({ length: 40 }, (_, i) => i + 1),
      (seed) => start({ seed }),
      (r) => {
        if (r.outcome?.result !== "loss") return false;
        const again = replay(r.session.log, WAVE6_DEPS);
        return again.ok && exercisedShowDeck(again.state, again.events);
      },
    );
    expect(result.outcome?.result).toBe("loss");
    const events = replayed(result);
    expect(exercisedShowDeck(result.session.state, events)).toBe(true);
    expect(events.some((e) => e.type === "villainFlipped")).toBe(true);
    // Never a discard: Cornered! and the SHOW environments live in the show deck, in play, or nowhere else.
    expect(result.session.state.scenarioDecks["show"]!.discard).toEqual([]);
  }, 300_000);

  it("is won: the final stage (Spiral II, CORNERED) is defeated", () => {
    // Staged by surgery: Spiral begins on her CORNERED side at stage II one hit point from defeat, because the greedy
    // driver cannot get through Cornered! on its own. Everything after that is played by the driver.
    const result = findGame(
      Array.from({ length: 20 }, (_, i) => i + 1),
      (seed) =>
        start({ seed }, (s) => {
          const cornered = withSpiral(s, { side: "B", stageIndex: 1 });
          return patchInstance(cornered, spiralOf(cornered), { damage: 14 });
        }),
      (r) => r.outcome?.result === "win",
    );
    expect(result.outcome?.result).toBe("win");
    const end = result.session.state;
    expect(end.villains.find((v) => v.instanceId === spiralOf(end))!.defeated).toBe(true);
    expect(inPlay(end, "39016")).toHaveLength(1);
    replayed(result);
  }, 300_000);
});

describe("Spiral (expert and two players)", () => {
  it("an expert game (Spiral II then III) plays to an outcome and replays deep-equal", () => {
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

describe.each([
  ["crime", "fantasy", "horror"],
  ["sci-fi", "sitcom", "western"],
])("Spiral with the %s, %s and %s genre sets", (...sets) => {
  it("plays to an outcome and replays deep-equal", () => {
    const result = playToOutcome(start({ seed: 5, modularSetIds: sets }), WAVE6_DEPS);
    expect(result.outcome).not.toBeNull();
    replayed(result);
  }, 120_000);
});
