import { cardId } from "@mc/content";
import {
  activeVillain,
  createGame,
  replay,
  undefeatedVillains,
  type GameSetupConfig,
  type GameState,
} from "@mc/engine";
import { describe, expect, it, test } from "vitest";
import { inst, instancesOf } from "../../../testing/harness.js";
import { playToOutcome } from "../../../testing/driver.js";
import { WAVE5_DEPS } from "../../index.js";
import { wave5Scenario, type Wave5ScenarioOptions } from "../../setup.js";

/**
 * The Sinister Six's own Setup (`sm` 27100a Sinister Synchronization 1A, MC27 p. 15, docs/phase7-wave5.md §1.5):
 * "Choose X villains at random, where X is 1 more than the number of players. Put those villains into play, place
 * the active counter on the villain with the lowest activation order value, and set the other villains aside. Put
 * the Light at the End side scheme into play, [Trap!] side faceup." Then three full games played headlessly by the
 * card-name-agnostic greedy driver to a real outcome and replayed to a deep-equal final state (the
 * `mysterio/scenario.test.ts` shape). Guerrilla Tactics (`sm` 27142–27146, `guerrilla-tactics.ts`) is this
 * scenario's own required set — `SM_SCENARIOS`'s `encounterSetIds` already names it alongside `sinister_six`, with
 * `recommendedModularSetIds: []` (no separate modular), so these games need no `modularSetIds` override at all; the
 * earlier `modularSetIds: [bomb_scare]` stand-in (added only because Guerrilla Tactics' own abilities weren't
 * registered yet) is gone now that they are — adding `guerrilla_tactics` there too would have doubled its cards
 * (`encounterCardsOf` pushes one copy of a set's cards per occurrence of that set id in its input list).
 */
const SIX_VILLAIN_IDS = [
  cardId("27094"), // Doctor Octopus, activation order 1
  cardId("27095"), // Electro, activation order 2
  cardId("27096"), // Hobgoblin, activation order 3
  cardId("27097"), // Kraven the Hunter, activation order 4
  cardId("27098"), // Scorpion, activation order 5
  cardId("27099"), // Vulture, activation order 6
];

function sinisterSixGame(players: Wave5ScenarioOptions["players"], overrides: Partial<Wave5ScenarioOptions> = {}) {
  const config: GameSetupConfig = wave5Scenario("sinister-six", { seed: 1, players, ...overrides });
  const created = createGame(config, WAVE5_DEPS);
  if (!created.ok) throw new Error(`setup failed: ${created.error.message}`);
  return { config, state: created.state };
}

const activationOrderOf = (state: GameState, id: (typeof SIX_VILLAIN_IDS)[number]): number =>
  SIX_VILLAIN_IDS.indexOf(id) + 1;

describe("wave5Scenario('sinister-six')", () => {
  it("standard, 1 player: 2 villains (players+1) in play, the lowest activation order holds the active counter, the other 4 set aside", () => {
    const { state } = sinisterSixGame([{ starterDeckId: "ghost-spider" }]);
    const inPlay = undefeatedVillains(state);
    expect(inPlay).toHaveLength(2);
    const active = activeVillain(state);
    expect(inPlay.map((v) => v.instanceId)).toContain(active.instanceId);
    const activeOrder = activationOrderOf(state, active.cardId as (typeof SIX_VILLAIN_IDS)[number]);
    for (const v of inPlay) {
      expect(activeOrder).toBeLessThanOrEqual(activationOrderOf(state, v.cardId as (typeof SIX_VILLAIN_IDS)[number]));
    }
    // The other 4 villains sit set aside, ready for "Ambush!" to draw from.
    const setAsideVillainCount = SIX_VILLAIN_IDS.filter((id) =>
      state.encounterSetAside.some((i) => inst(state, i).cardId === id),
    ).length;
    expect(setAsideVillainCount).toBe(4);
    expect(inPlay).toHaveLength(6 - setAsideVillainCount);
  });

  it("standard, 2/3/4 players: players+1 villains in play", () => {
    const twoPlayer = sinisterSixGame([{ starterDeckId: "ghost-spider" }, { starterDeckId: "spider-man-morales" }]);
    expect(undefeatedVillains(twoPlayer.state)).toHaveLength(3);
    const threePlayer = sinisterSixGame([
      { starterDeckId: "ghost-spider" },
      { starterDeckId: "spider-man-morales" },
      { starterDeckId: "core-spider-man-justice" },
    ]);
    expect(undefeatedVillains(threePlayer.state)).toHaveLength(4);
    const fourPlayer = sinisterSixGame([
      { starterDeckId: "ghost-spider" },
      { starterDeckId: "spider-man-morales" },
      { starterDeckId: "core-spider-man-justice" },
      { starterDeckId: "core-captain-marvel-leadership" },
    ]);
    expect(undefeatedVillains(fourPlayer.state)).toHaveLength(5);
  });

  it('Light at the End (27102a) enters play Trap! side faceup, with its printed 10 starting threat plus its own Hinder 10[per_hero] (RRG 1.8 "Hinder X", p. 22: placed in addition to starting threat), and neither face is in the shuffled encounter deck', () => {
    const { config, state } = sinisterSixGame([{ starterDeckId: "ghost-spider" }]);
    const light = instancesOf(state, "27102a")[0];
    expect(light).toBeDefined();
    expect(state.villainArea).toContain(light);
    expect(inst(state, light!).faceup).toBe(true);
    expect(inst(state, light!).threat).toBe(20); // 10 starting threat + Hinder 10[per_hero] for 1 player
    expect(config.encounterDeck).not.toContain(cardId("27102a"));
    expect(config.encounterDeck).not.toContain(cardId("27102b"));
    // Its Chase! face is only ever reached by flipping this same instance, never drawn or dealt on its own.
    expect(instancesOf(state, "27102b")).toHaveLength(0);
  });

  it("expert mode adds Core's Expert encounter set to the shared deck; standard does not (RRG 1.8 Expert Mode)", () => {
    const standard = wave5Scenario("sinister-six", { seed: 2, players: [{ starterDeckId: "ghost-spider" }] });
    const expert = wave5Scenario("sinister-six", {
      seed: 2,
      players: [{ starterDeckId: "ghost-spider" }],
      difficulty: "expert",
    });
    expect(expert.encounterDeck.length).toBeGreaterThan(standard.encounterDeck.length);
  });

  it("none of the six villain cards or Light at the End are shuffled into the encounter deck", () => {
    const { config } = sinisterSixGame([{ starterDeckId: "ghost-spider" }]);
    for (const id of SIX_VILLAIN_IDS) expect(config.encounterDeck).not.toContain(id);
  });

  it('the win is a card ability (Light at the End\'s own escape), not defeating every villain: config carries victory: "cardAbility"', () => {
    const { config } = sinisterSixGame([{ starterDeckId: "ghost-spider" }]);
    expect(config.victory).toBe("cardAbility");
  });

  it("refuses a players count outside 1-4", () => {
    expect(() => sinisterSixGame([])).toThrow(/1-4/);
  });
});

/** Plays `config` to an outcome with the greedy driver and checks the log replays to the same final state. */
function playAndReplay(config: GameSetupConfig) {
  const created = createGame(config, WAVE5_DEPS);
  if (!created.ok) throw new Error(`setup failed: ${created.error.message}`);
  const result = playToOutcome(created.state, WAVE5_DEPS);
  expect(result.outcome).not.toBeNull();
  expect(result.rounds).toBeGreaterThanOrEqual(1);
  const replayed = replay(result.session.log, WAVE5_DEPS);
  expect(replayed.ok).toBe(true);
  if (replayed.ok) expect(replayed.state).toEqual(result.session.state);
  return result;
}

test("The Sinister Six, solo: Ghost-Spider", () => {
  playAndReplay(
    wave5Scenario("sinister-six", {
      seed: 2026,
      players: [{ starterDeckId: "ghost-spider" }],
    }),
  );
}, 120_000);

test("The Sinister Six, solo: a Core precon (Captain Marvel / Leadership)", () => {
  playAndReplay(
    wave5Scenario("sinister-six", {
      seed: 2027,
      players: [{ starterDeckId: "core-captain-marvel-leadership" }],
    }),
  );
}, 120_000);

test("The Sinister Six, 2 players: Spider-Man (Miles Morales) and Ghost-Spider, 3 villains in play", () => {
  playAndReplay(
    wave5Scenario("sinister-six", {
      seed: 2028,
      players: [{ starterDeckId: "spider-man-morales" }, { starterDeckId: "ghost-spider" }],
    }),
  );
}, 180_000);

/** rules-qa-engineer's own addition (docs/phase7-wave5-qa-sm-scenarios-2.md §2): the testing bar's expert-mode game,
 * missing from the earlier pass — the "All first" §4.1 Q71 ruling and expert-only incite/surge text (Frequent
 * Flyers/High Fashion/Robotic Enhancements/Surprise!/Life-Size Decoy's own toughness) only ever run in expert mode. */
test("The Sinister Six, solo expert: Ghost-Spider", () => {
  playAndReplay(
    wave5Scenario("sinister-six", {
      seed: 2029,
      players: [{ starterDeckId: "ghost-spider" }],
      difficulty: "expert",
    }),
  );
}, 120_000);
