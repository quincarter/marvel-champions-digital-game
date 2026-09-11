import { characterProfile, type GameState, type InstanceId } from "@mc/engine";
import { CORE_DEPS } from "../index.js";
import { coreScenario } from "../setup.js";
import {
  endTurn,
  firstLegal,
  identityOf,
  inst,
  mainThreat,
  P1,
  patchInstance,
  playerOf,
  run,
  settle,
  stackEncounterDeck,
  startCoreGame,
  toHero,
} from "../../testing/harness.js";

const vsUltron = () => startCoreGame(coreScenario("ultron", { players: [{ starterDeckId: "core-iron-man-aggression" }], seed: 8 }));
const dronesOf = (state: GameState) => playerOf(state, P1).playArea.filter((id) => inst(state, id).facedownAs !== null);
const attack = (state: GameState, target: InstanceId) => ({ type: "basicAttack", playerId: P1, attackerInstanceId: identityOf(state), targetInstanceId: target }) as const;

describe("coreScenario('ultron')", () => {
  it("setup: Ultron Drones enters play and 1B gives each player a facedown Drone with a base ATK/SCH/hit points of 1", () => {
    const state = vsUltron();
    expect(state.villainArea.some((id) => inst(state, id).cardId === "01140")).toBe(true);
    const drones = dronesOf(state);
    expect(drones).toHaveLength(1);
    const profile = characterProfile(state, drones[0] as InstanceId, CORE_DEPS);
    expect([profile?.atk, profile?.sch, profile?.maxHp]).toEqual([1, 1, 1]);
  });
});

describe("Ultron", () => {
  it("Ultron (III): Drones get +1 ATK/+1 hit point, and Ultron can't take damage while a Drone is in play", () => {
    const start = vsUltron();
    // Test surgery: jump to stage III (its When Revealed isn't under test here).
    const stageThree: GameState = { ...start, villain: { ...start.villain, stageIndex: 2, lastStageIndex: 2 } };
    const profile = characterProfile(stageThree, dronesOf(stageThree)[0] as InstanceId, CORE_DEPS);
    expect([profile?.atk, profile?.maxHp]).toEqual([2, 2]);
    const after = settle(run(stageThree, toHero(), attack(stageThree, stageThree.villain.instanceId)));
    expect(inst(after, after.villain.instanceId).damage).toBe(0);
  });

  it("Advanced Ultron Drone: when it's defeated, the engaged player puts the top card of their deck into play as a Drone", () => {
    const round2 = settle(run(stackEncounterDeck(vsUltron(), "01186", "01143"), endTurn()));
    const advanced = playerOf(round2, P1).playArea.find((id) => inst(round2, id).cardId === "01143") as InstanceId;
    const before = dronesOf(round2).length;
    const after = settle(run(patchInstance(round2, advanced, { damage: 3 }), toHero(), attack(round2, advanced)));
    expect(after.encounterDiscard).toContain(advanced);
    expect(dronesOf(after)).toHaveLength(before + 1);
  });

  it("Android Efficiency's boost: declining to spend a [energy] resource gives the attacked player a Drone", () => {
    const hero = run(stackEncounterDeck(vsUltron(), "01144a", "01149"), toHero());
    const before = dronesOf(hero).length;
    const after = settle(run(hero, endTurn()));
    expect(dronesOf(after)).toHaveLength(before + 1);
  });
});

describe("Assault on NORAD (main scheme 2B)", () => {
  const atNorad = (): GameState => {
    const start = vsUltron();
    // Test surgery: the main scheme at stage 2B with no threat.
    const moved: GameState = { ...start, mainScheme: { ...start.mainScheme, stageIndex: 1 } };
    return stackEncounterDeck(patchInstance(moved, moved.mainScheme.instanceId, { threat: 0 }), "01186", "01149");
  };
  const playRound = (state: GameState, pick: "0" | "1") => {
    let prompts = 0;
    const after = settle(run(state, endTurn()), (s) => {
      if (s.pendingChoice?.options.some((o) => o.label === "Place 2 threat here")) {
        prompts++;
        return [pick];
      }
      return firstLegal(s);
    });
    return { after, prompts };
  };

  it("after step one places threat here, each player chooses once — its own 2 threat doesn't retrigger it", () => {
    const start = atNorad();
    const { after, prompts } = playRound(start, "0");
    expect(prompts).toBe(1);
    expect(mainThreat(after)).toBeGreaterThanOrEqual(mainThreat(start) + 1 + 2);
  });

  it("choosing the Drone puts the top card of your deck into play facedown", () => {
    const start = atNorad();
    const { after, prompts } = playRound(start, "1");
    expect(prompts).toBe(1);
    expect(dronesOf(after)).toHaveLength(dronesOf(start).length + 1);
  });
});
