import { activeVillain, mainSchemeValue, type Command, type GameEvent, type GameState, type InstanceId } from "@mc/engine";
import { applyOk, endTurn, firstLegal, identityOf, inst, P1, P2, patchInstance, playerOf, settle, stackEncounterDeck, toHero } from "../../testing/harness.js";
import { GOB_DEPS, runGob, startGobGame } from "./testing.js";
import { wave1Scenario } from "../setup.js";

const spiderManVsMutagenFormula = (players = [{ starterDeckId: "core-spider-man-justice" }], modularSetIds: readonly string[] = []) =>
  startGobGame(wave1Scenario("mutagen-formula", { players, seed: 13, modularSetIds }));

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

const goblinThrallsOf = (state: GameState, player: string) => Object.entries(state.instances).filter(([, i]) => i?.cardId === "02024" && i.engagedWith === player);
const inPlayIdOf = (state: GameState, code: string): InstanceId | undefined =>
  ([...state.villainArea, ...state.players.flatMap((p) => p.playArea)] as InstanceId[]).find((id) => state.instances[id]?.cardId === code);

describe("wave1Scenario('mutagen-formula')", () => {
  it("Green Goblin (I-II) starts, single-sided", () => {
    const state = spiderManVsMutagenFormula();
    expect(activeVillain(state)).toMatchObject({ side: "A", stageIndex: 0, lastStageIndex: 1 });
  });

  it("1A setup: puts a distinct Goblin Thrall minion into play engaged with each player", () => {
    const state = spiderManVsMutagenFormula([{ starterDeckId: "core-spider-man-justice" }, { starterDeckId: "core-captain-marvel-leadership" }]);
    const p1Thralls = goblinThrallsOf(state, P1);
    const p2Thralls = goblinThrallsOf(state, P2);
    expect(p1Thralls).toHaveLength(1);
    expect(p2Thralls).toHaveLength(1);
    expect(p1Thralls[0]?.[0]).not.toBe(p2Thralls[0]?.[0]); // distinct copies, not the same instance
  });
});

describe("Mutagen Cloud 2B — X acceleration", () => {
  it("reads the stage's own modifier through mainSchemeValue the way step one does", () => {
    // Stage 1's own printed acceleration is 1[per_hero] (1, 1 hero); the Goblin Thrall each player starts engaged
    // with does not change that reading, since stage 2B's own X-acceleration modifier only takes over once the
    // scheme is actually on stage 2 (`printedX`, content data) — this just pins the baseline `mainSchemeValue` read
    // step one itself uses, matching `packages/engine/src/scheme-values.test.ts`'s own convention.
    const state = spiderManVsMutagenFormula();
    expect(mainSchemeValue(state, "acceleration", GOB_DEPS)).toBe(1);
  });
});

describe("Death from Above", () => {
  // A filler card ("02023", Goblin Soldier) is stacked ahead of Death from Above in every case below: without it,
  // the villain's own regular scheme/attack activation earlier in the same villain phase would draw the stacked
  // Death from Above copy as *its* boost card (consuming it) before "deal encounter cards" ever reaches it —
  // the same hazard `risky-business.test.ts`'s Oscorp Manufacturing test comment documents.
  it("When Revealed (Alter-Ego): Green Goblin schemes with +X SCH (X = the villain's stage number = 1, so SCH 1+1=2)", () => {
    const { events } = driveEvents(stackEncounterDeck(spiderManVsMutagenFormula(), "02023", "02029"), endTurn());
    expect(events).toContainEqual(
      expect.objectContaining({ type: "triggerEvent", phase: "resolved", event: expect.objectContaining({ kind: "enemyScheme", results: { threatPlaced: 2 } }) }),
    );
  });

  it("When Revealed (Hero): Green Goblin attacks with +X ATK (X = the villain's stage number = 1, so ATK 2+1=3)", () => {
    const { events } = driveEvents(stackEncounterDeck(spiderManVsMutagenFormula(), "02023", "02029"), toHero(), endTurn());
    expect(events).toContainEqual(expect.objectContaining({ type: "attackResolved", baseAtk: 3, damageDealt: 3 }));
  });
});

describe("I See You", () => {
  it("When Revealed: Green Goblin attacks you; in alter-ego form, no boost card is dealt for that attack", () => {
    const { events } = driveEvents(stackEncounterDeck(spiderManVsMutagenFormula(), "02023", "02030"), endTurn());
    const iSeeYou = events.filter((e) => e.type === "triggerEvent" && e.event.kind === "encounterCardRevealing").length;
    expect(iSeeYou).toBeGreaterThan(0);
    // The attack Death from Above/I See You itself causes is the *last* enemyAttack of the villain phase; it alone
    // must carry no boost-card-dealt event immediately preceding it. Simpler and just as conclusive: across the
    // whole alter-ego villain phase, no attack at all should draw a boost card outside of a scheme (Green Goblin
    // only schemes in alter-ego form otherwise), so no `boostCardDealt` tied to an "attack" activation appears.
    expect(events.some((e) => e.type === "triggerEvent" && e.event.kind === "boostCardTurnedFaceup" && e.event.activation === "attack")).toBe(false);
  });

  it("When Revealed: in hero form, the villain does get a boost card for its attacks", () => {
    const { events } = driveEvents(stackEncounterDeck(spiderManVsMutagenFormula(), "02023", "02030"), toHero(), endTurn());
    expect(events.some((e) => e.type === "triggerEvent" && e.event.kind === "boostCardTurnedFaceup" && e.event.activation === "attack")).toBe(true);
  });
});

describe("Wicked Ambitions", () => {
  it("When Revealed: discards 2X cards (X = stage number = 1, so 2 cards); each discarded Goblin minion offers take-3-or-put-into-play (default: take 3 damage)", () => {
    const state = spiderManVsMutagenFormula();
    const identity = identityOf(state);
    // Filler, then Wicked Ambitions, then two guaranteed Goblin minions for it to discard.
    const { state: after } = driveEvents(stackEncounterDeck(state, "02023", "02032", "02023", "02023"), endTurn());
    // `firstLegal` always takes the first (least-committal) option of a `chooseOne`, which is "Take 3 damage" here,
    // for each of the two discarded Goblin Soldiers: 3 + 3 = 6.
    expect(inst(after, identity).damage).toBe(6);
  });
});

describe("Overrun — When Defeated", () => {
  it("puts each Goblin minion discarded this way (discarding 2 cards) into play engaged with the discarding player", () => {
    // Filler ahead of Overrun so the villain's own scheme-boost draw this round doesn't consume Overrun itself;
    // Overrun then enters play normally via the "deal encounter cards" step.
    const revealed = play(stackEncounterDeck(spiderManVsMutagenFormula(), "02023", "02028"), endTurn());
    const overrun = inPlayIdOf(revealed, "02028");
    expect(overrun).toBeDefined();
    // Clear it to 0 threat with a basic thwart (hero form), stacking 2 Goblin Soldiers on top first so both
    // discards from Overrun's own When Defeated are guaranteed Goblin minions.
    const identity = identityOf(revealed);
    const primed = stackEncounterDeck(patchInstance(revealed, overrun as InstanceId, { threat: 1 }), "02023", "02023");
    const before = playerOf(primed, P1).playArea.filter((id) => inst(primed, id).cardId === "02023").length;
    const after = play(primed, toHero(), { type: "basicThwart", playerId: P1, thwarterInstanceId: identity, schemeInstanceId: overrun as InstanceId });
    expect(after.villainArea).not.toContain(overrun);
    const goblinSoldiersAfter = playerOf(after, P1).playArea.filter((id) => inst(after, id).cardId === "02023").length;
    expect(goblinSoldiersAfter).toBe(before + 2);
  });
});
