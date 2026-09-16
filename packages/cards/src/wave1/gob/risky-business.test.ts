import { activeVillain, currentName, type Command, type GameEvent, type GameState } from "@mc/engine";
import { applyOk, endTurn, firstLegal, identityOf, inst, P1, patchInstance, playerOf, settle, stackEncounterDeck, toHero } from "../../testing/harness.js";
import { GOB_DEPS, runGob, startGobGame } from "./testing.js";
import { wave1Scenario } from "../setup.js";

const spiderManVsRiskyBusiness = (difficulty: "standard" | "expert" = "standard") =>
  startGobGame(wave1Scenario("risky-business", { difficulty, players: [{ starterDeckId: "core-spider-man-justice" }], seed: 11, modularSetIds: [] }));

/** Runs commands and settles every resulting choice with the default (least-committal) pick. */
const play = (state: GameState, ...commands: readonly Command[]): GameState => settle(runGob(state, ...commands), undefined, undefined, GOB_DEPS);

/** Like `play`, but also collects every event along the way (commands and every auto-settled choice). */
function driveEvents(state: GameState, ...commands: readonly Command[]): { readonly state: GameState; readonly events: readonly GameEvent[] } {
  let current = state;
  const events: GameEvent[] = [];
  const settleOne = () => {
    while (current.pendingChoice && !current.outcome) {
      const choice = current.pendingChoice;
      const result = applyOk(current, { type: "resolveChoice", playerId: choice.playerId, choiceId: choice.choiceId, selectedOptionIds: firstLegal(current) }, GOB_DEPS);
      current = result.state;
      events.push(...result.events);
    }
  };
  settleOne();
  for (const command of commands) {
    const result = applyOk(current, command, GOB_DEPS);
    current = result.state;
    events.push(...result.events);
    settleOne();
  }
  return { state: current, events };
}

const criminalEnterpriseId = (state: ReturnType<typeof spiderManVsRiskyBusiness>) =>
  [...state.villainArea, ...state.removedFromGame].find((id) => state.instances[id]?.cardId === "02006a")!;

describe("wave1Scenario('risky-business')", () => {
  it("Norman Osborn (I-II) starts, side A; Criminal Enterprise enters play from the 1A setup ability", () => {
    const state = spiderManVsRiskyBusiness();
    expect(activeVillain(state)).toMatchObject({ side: "A", stageIndex: 0, lastStageIndex: 1 });
    const enterprise = criminalEnterpriseId(state);
    expect(state.villainArea).toContain(enterprise);
    expect(inst(state, enterprise).cardId).toBe("02006a");
  });

  it("expert: Norman Osborn (II-III)", () => {
    const state = spiderManVsRiskyBusiness("expert");
    expect(activeVillain(state)).toMatchObject({ side: "A", stageIndex: 1, lastStageIndex: 2 });
  });
});

describe("Norman Osborn's Forced Interrupts", () => {
  it("would attack: places 1 infamy counter on Criminal Enterprise instead, and deals no damage", () => {
    const start = play(spiderManVsRiskyBusiness(), toHero());
    const enterprise = criminalEnterpriseId(start);
    const before = inst(start, enterprise).counters.infamy ?? 0;
    const after = play(start, endTurn());
    expect(inst(after, enterprise).counters.infamy).toBe(before + 1);
    expect(inst(after, identityOf(after)).damage).toBe(0);
  });

  it("would take damage: removes that many infamy counters from Criminal Enterprise instead", () => {
    const start = spiderManVsRiskyBusiness();
    const villain = activeVillain(start).instanceId;
    const enterprise = criminalEnterpriseId(start);
    const primed = patchInstance(start, enterprise, { counters: { infamy: 5 } });
    const identity = identityOf(primed);
    const attacked = runGob(primed, toHero(), { type: "basicAttack", playerId: P1, attackerInstanceId: identity, targetInstanceId: villain });
    expect(inst(attacked, villain).damage).toBe(0);
    expect(inst(attacked, enterprise).counters.infamy).toBeLessThan(5);
  });
});

describe("Hostile Takeover 1B — When Completed", () => {
  it("places 1[per_hero] infamy counters on Criminal Enterprise, then discards 1 card from each player's deck per infamy counter there", () => {
    const start = spiderManVsRiskyBusiness();
    const enterprise = criminalEnterpriseId(start);
    const scheme = start.mainScheme.instanceId;
    // Threat 1 below target (7 for 1 hero): step one's own acceleration (1[per_hero]) pushes it to target, completing
    // the scheme through the real event system (a direct patch to the target value would not fire the completion
    // check at all, since that check runs where threat is *placed*, not on every read).
    const primed = patchInstance(patchInstance(start, enterprise, { counters: { infamy: 1 } }), scheme, { threat: 6 });
    // A single `endTurn()` application drives step one's threat placement, the completion, the advance, and the
    // rest of the villain phase (including the villain's own later scheme activation, which can deal a boost card
    // that adds *more* infamy of its own — Hired Gun/Private Security Specialist/Collapsing Bridge/Payoff all do)
    // in one go, with no pending choice in between to pause on. So this reads the *events* of that one application
    // rather than final state, which the later scheme activation would also have touched.
    const { events } = driveEvents(primed, endTurn());
    const completedAt = events.findIndex((e) => e.type === "mainSchemeCompleted");
    const advancedAt = events.findIndex((e) => e.type === "mainSchemeAdvanced");
    const infamyAddedAt = events.findIndex((e) => e.type === "counterAdded" && e.instanceId === enterprise && e.counterType === "infamy");
    const discards = events.filter((e) => e.type === "cardMoved" && e.instanceId !== undefined && "from" in e && e.from.kind === "deck" && e.to.kind === "discard");
    expect(completedAt).toBeGreaterThanOrEqual(0);
    expect(infamyAddedAt).toBeGreaterThan(completedAt); // the infamy counter is added by When Completed, after completion
    expect(infamyAddedAt).toBeLessThan(advancedAt); // and before the scheme advances (RRG 1.8 "When Completed Abilities", p. 48)
    expect(discards).toHaveLength(2); // 1 discard per infamy counter (1 + 1[per_hero] = 2) on Criminal Enterprise
    expect(advancedAt).toBeGreaterThanOrEqual(0);
  });
});

describe("Criminal Enterprise / State of Madness — the scenario's win condition", () => {
  it("enters play with 2[per_hero] infamy counters, so there is something to strip", () => {
    const solo = spiderManVsRiskyBusiness();
    expect(inst(solo, criminalEnterpriseId(solo)).counters.infamy).toBe(2);
    const two = startGobGame(
      wave1Scenario("risky-business", {
        players: [{ starterDeckId: "core-spider-man-justice" }, { starterDeckId: "core-black-panther-protection" }],
        seed: 11,
        modularSetIds: [],
      }),
    );
    const enterprise = [...two.villainArea].find((id) => two.instances[id]?.cardId === "02006a")!;
    expect(inst(two, enterprise).counters.infamy).toBe(4);
  });

  it("flips Norman Osborn into Green Goblin the moment the last infamy counter comes off", () => {
    const start = spiderManVsRiskyBusiness();
    const villain = activeVillain(start).instanceId;
    const enterprise = criminalEnterpriseId(start);
    // One counter left, against a hero who hits for more: the attack's damage is replaced by counter removal
    // (Norman's Forced Interrupt), which empties the card and trips the state check.
    const primed = patchInstance(start, enterprise, { counters: { infamy: 1 } });
    const identity = identityOf(primed);
    const after = play(primed, toHero(), { type: "basicAttack", playerId: P1, attackerInstanceId: identity, targetInstanceId: villain });

    expect(activeVillain(after).side).toBe("B");
    expect(currentName(after, villain)).toBe("Green Goblin");
    expect(currentName(after, enterprise)).toBe("State of Madness");
    // §4.1: the new face's "enter play with N counters" applies on the flip, or State of Madness arrives empty
    // and flips straight back on the next state check.
    expect(inst(after, enterprise).counters.madness).toBe(2);
    expect(inst(after, enterprise).counters.infamy ?? 0).toBe(0);
  });

  it("flips back to Norman Osborn when the madness counters run out, and re-arms the infamy side", () => {
    const start = spiderManVsRiskyBusiness();
    const villain = activeVillain(start).instanceId;
    const enterprise = criminalEnterpriseId(start);
    const goblin = play(
      patchInstance(start, enterprise, { counters: { infamy: 1 } }),
      toHero(),
      { type: "basicAttack", playerId: P1, attackerInstanceId: identityOf(start), targetInstanceId: villain },
    );
    expect(currentName(goblin, enterprise)).toBe("State of Madness");

    // Green Goblin's own Forced Interrupt spends a madness counter instead of schemeing, so ending the turn with
    // one left empties the card and flips the pair back.
    const back = play(patchInstance(goblin, enterprise, { counters: { madness: 1 } }), endTurn());
    expect(activeVillain(back).side).toBe("A");
    expect(currentName(back, enterprise)).toBe("Criminal Enterprise");
    expect(inst(back, enterprise).counters.infamy).toBe(2);
  });
});

describe("Oscorp Manufacturing", () => {
  it("When Revealed (Norman Osborn): places an additional 1[per_hero] threat here", () => {
    // Hero form so Norman Osborn's own Forced Interrupt fully replaces his attack (FAQ "Norman Osborn (#1A)", p. 58:
    // a replaced activation deals no boost card), leaving the stacked 02010 on top of the deck for the later "deal
    // encounter cards" step to reveal as a treachery/side scheme, rather than being drawn as his scheme's boost card.
    const after = play(stackEncounterDeck(spiderManVsRiskyBusiness(), "02010"), toHero(), endTurn());
    const oscorp = Object.keys(after.instances).find((id) => after.instances[id as never]?.cardId === "02010" && after.villainArea.includes(id as never)) as never;
    // Printed startingThreat 2[per_hero] (2, 1 hero) + the ability's additional 1[per_hero] (1) = 3.
    expect(inst(after, oscorp).threat).toBe(3);
  });
});
