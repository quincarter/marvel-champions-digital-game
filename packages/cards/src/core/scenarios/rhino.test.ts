import { characterProfile } from "@mc/engine";
import { CORE_DEPS } from "../index.js";
import { coreScenario } from "../setup.js";
import {
  answer,
  endTurn,
  identityOf,
  inst,
  instancesOf,
  mainThreat,
  moveToHand,
  P1,
  payWith,
  play,
  playerOf,
  run,
  settle,
  settleUntil,
  stackEncounterDeck,
  startCoreGame,
  toHero,
} from "../../testing/harness.js";

const spiderManVsRhino = (difficulty: "standard" | "expert" = "standard") =>
  startCoreGame(coreScenario("rhino", { difficulty, players: [{ starterDeckId: "core-spider-man-justice" }], seed: 11 }));
const ADVANCE = "01186";
const HARD_TO_KEEP_DOWN = "01104";
const HYDRA_MERCENARY = "01101";
const engaged = (state: ReturnType<typeof spiderManVsRhino>, code: string) => playerOf(state, P1).playArea.filter((id) => inst(state, id).cardId === code);

describe("coreScenario('rhino')", () => {
  it("standard: Rhino I–II; Rhino + Bomb Scare + Standard sets and Eviction Notice shuffled in; the nemesis set aside", () => {
    const state = spiderManVsRhino();
    expect([state.villain.stageIndex, state.villain.lastStageIndex]).toEqual([0, 1]);
    // Rhino set 17 + Bomb Scare 6 + Standard 7 + the obligation.
    expect(state.encounterDeck).toHaveLength(31);
    expect(state.encounterDeck.some((id) => inst(state, id).cardId === "01165")).toBe(true);
    expect(playerOf(state, P1).setAside.map((id) => inst(state, id).cardId).sort()).toEqual(["01166", "01167", "01168", "01168", "01169"]);
  });

  it("expert: Rhino (II) starts and reveals Breakin' & Takin' during setup; the Expert set is in the deck", () => {
    const state = spiderManVsRhino("expert");
    expect([state.villain.stageIndex, state.villain.lastStageIndex]).toEqual([1, 2]);
    const breakin = instancesOf(state, "01107")[0];
    expect(state.villainArea).toContain(breakin);
    expect(inst(state, breakin as never).threat).toBe(3);
    expect(state.encounterDeck.some((id) => inst(state, id).cardId === "01192")).toBe(true);
  });
});

describe("Rhino encounter set", () => {
  it("Charge: Rhino gets +3 ATK; his attack gains overkill (a defending ally's excess goes to its controller); then Charge is discarded", () => {
    const round2 = settle(run(stackEncounterDeck(spiderManVsRhino(), ADVANCE, "01099"), endTurn()));
    const charge = instancesOf(round2, "01099").find((id) => inst(round2, id).attachedTo === round2.villain.instanceId);
    expect(charge).toBeDefined();
    expect(characterProfile(round2, round2.villain.instanceId, CORE_DEPS)?.atk).toBe(5);
    const given = moveToHand(round2, P1, "01002"); // Black Cat, 2 hit points
    const [cat] = given.ids as [never];
    const withCat = settle(run(given.state, toHero(), play(P1, cat, payWith(given.state, P1, 2, [cat]))));
    const atDefense = settleUntil(run(stackEncounterDeck(withCat, HARD_TO_KEEP_DOWN, HYDRA_MERCENARY), endTurn()), "declareDefender");
    const after = answer(atDefense, [cat]);
    expect(playerOf(after, P1).discard).toContain(cat);
    expect(inst(after, identityOf(after)).damage).toBe(3); // 5 into 2 hit points
    expect(after.encounterDiscard).toContain(charge);
  });

  it("Breakin' & Takin': enters with 2 + 1 [per_hero] threat; its hazard icon deals an extra encounter card", () => {
    const round2 = settle(run(stackEncounterDeck(spiderManVsRhino(), ADVANCE, "01107"), endTurn()));
    const breakin = instancesOf(round2, "01107")[0] as never;
    expect(round2.villainArea).toContain(breakin);
    expect(inst(round2, breakin).threat).toBe(3);
    const round3 = settle(run(stackEncounterDeck(round2, HARD_TO_KEEP_DOWN, HYDRA_MERCENARY, HYDRA_MERCENARY), endTurn()));
    expect(engaged(round3, HYDRA_MERCENARY)).toHaveLength(2);
  });

  it("Stampede (hero): Rhino attacks you; a character damaged by the attack is stunned", () => {
    const after = settle(run(stackEncounterDeck(spiderManVsRhino(), ADVANCE, "01106", "01187"), toHero(), endTurn()));
    expect(inst(after, identityOf(after))).toMatchObject({ damage: 4, statuses: { stunned: 1 } });
  });

  it("Stampede (alter-ego): the card gains surge", () => {
    const after = settle(run(stackEncounterDeck(spiderManVsRhino(), ADVANCE, "01106", HYDRA_MERCENARY), endTurn()));
    expect(engaged(after, HYDRA_MERCENARY)).toHaveLength(1);
    expect(inst(after, identityOf(after)).statuses.stunned).toBe(0);
  });

  it("Hard to Keep Down: Rhino heals 4; with no damage to heal, it surges", () => {
    const after = settle(run(stackEncounterDeck(spiderManVsRhino(), ADVANCE, HARD_TO_KEEP_DOWN, HYDRA_MERCENARY), endTurn()));
    expect(engaged(after, HYDRA_MERCENARY)).toHaveLength(1);
  });
});

describe("Bomb Scare modular set", () => {
  it("Bomb Scare: enters with 2 + 1 [per_hero] threat; its acceleration icon adds 1 threat to the main scheme in step one", () => {
    const round2 = settle(run(stackEncounterDeck(spiderManVsRhino(), ADVANCE, "01109"), endTurn()));
    expect(inst(round2, instancesOf(round2, "01109")[0] as never).threat).toBe(3);
    const stacked = stackEncounterDeck(round2, HARD_TO_KEEP_DOWN, HYDRA_MERCENARY);
    const round3 = settle(run(stacked, toHero(), endTurn()));
    // Hero form, so Rhino attacks instead of scheming: The Break-In!'s acceleration (1 per hero) + 1 acceleration icon.
    expect(mainThreat(round3) - mainThreat(stacked)).toBe(2);
  });

  it("Explosion: assign X damage among heroes and allies, one point at a time, X = the threat on Bomb Scare", () => {
    const round2 = settle(run(stackEncounterDeck(spiderManVsRhino(), ADVANCE, "01109"), endTurn()));
    const bombScare = instancesOf(round2, "01109")[0] as never;
    let state = settleUntil(run(stackEncounterDeck(round2, HARD_TO_KEEP_DOWN, "01111"), toHero(), endTurn()), "chooseTarget");
    const x = inst(state, bombScare).threat;
    const before = inst(state, identityOf(state)).damage;
    let points = 0;
    while (state.pendingChoice?.prompt.kind === "chooseTarget" && state.pendingChoice.prompt.slot === "assignDamage") {
      state = answer(state, [identityOf(state)]);
      points++;
    }
    expect(x).toBe(3);
    expect(points).toBe(x);
    expect(inst(state, identityOf(state)).damage - before).toBe(x);
  });

  it("Explosion without Bomb Scare in play gains surge", () => {
    const after = settle(run(stackEncounterDeck(spiderManVsRhino(), ADVANCE, "01111", HYDRA_MERCENARY), endTurn()));
    expect(engaged(after, HYDRA_MERCENARY)).toHaveLength(1);
  });
});
