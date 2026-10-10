import {
  applyCommand,
  cardsInPlay,
  characterProfile,
  maxHitPoints,
  type Command,
  type EngineDeps,
  type GameEvent,
  type GameState,
  type InstanceId,
} from "@mc/engine";
import { describe, expect, it, vi } from "vitest";
import { mergeRegistries } from "../../../dsl/index.js";
import {
  P1,
  endTurn,
  firstLegal,
  identityOf,
  inst,
  moveToHand,
  play,
  playerOf,
  settle,
  stackEncounterDeck,
  use,
  type Picker,
} from "../../../testing/harness.js";
import { driveEventsPicking, stageNemesisCardForReveal, withForm } from "../../../testing/staging.js";
import { WAVE8_ABILITIES } from "../../../wave8/index.js";
import { AOS_ASPECT_BASIC, AOS_ASPECT_BASIC_SKIPPED } from "../aspect-basic.js";
import { MARIA_HILL_EVENTS } from "./events.js";
import { MARIA_HILL_IDENTITY } from "./identity.js";
import { MARIA_HILL_OBLIGATION_NEMESIS } from "./obligation-nemesis.js";
import { MARIA_HILL_SUPPORT_UPGRADES_ALLIES } from "./support-upgrades-allies.js";
import { inPlay, mariaGame } from "./testing.js";

vi.setConfig({ testTimeout: 240_000 });

/**
 * Whole-game test for Maria Hill's printed precon (`maria-hill-leadership`, cards 50002-50028) against Core's Rhino
 * (standard, solo), docs/phase7-wave9.md section 8.4 ("Maria Hill starter deck e2e"). Five rounds played through the
 * engine's real commands, one decision at a time, ending with Rhino's stage I defeated. Only the deck order and the
 * encounter deck are seeded (`moveToHand` for the cards a round needs, `stackEncounterDeck` for the villain phase, and
 * `stageNemesisCardForReveal` to move the set-aside nemesis cards onto the encounter deck, as the kit tests do); every
 * play, ability and attack is a command the engine validates. Deterministic by seed (1). The dependencies are built
 * from `WAVE8_ABILITIES`, the box's aspect/basic cards and Maria Hill's own four modules only.
 *
 * Rules the game leans on (RRG 1.8 = mc_rulesreference_v18_compressed.md; page numbers as the modules cite them):
 * - "All-Purpose Counter" (p. 6): an all-purpose counter placed on, or moved to, a card that defines a counter type
 *   becomes that type (Reassignment, Nick Fury 50002, Reinforcements 50005, Special Funding 50007, Director 50011).
 * - "Uses" (p. 46): a card whose last Uses counter is removed is discarded (by an ability's cost, by Reassignment).
 * - "Search" (p. 39): Maria Hill's search shuffles the deck afterward.
 * - "'For Each'" (p. 20) and MC50 p. 22: All-Points Bulletin chooses once per S.H.I.E.L.D. support, counted as it
 *   resolves, and may mix the two options and repeat a target.
 * - "Printed" (p. 35): The Hard Call reads the discarded support's printed cost.
 * - Villain phase (Appendix II, pp. 51-52): step 1 threat on the main scheme (plus acceleration icons), step 2 the
 *   villain then the minions activate (an enemy attacks a hero-form identity and schemes against an alter-ego one),
 *   step 3 deal, step 4 reveal. "End of Player Phase": discard, draw up to hand size, ready all cards.
 *
 * Not exercised here (covered by the kit tests in this folder and aspect-basic.test.ts): Victoria Hand 50012 and
 * Slingshot 50013's abilities, Dum Dum Dugan 50021, Grant Ward 50022, Melinda May 50023, Super Spies 50024, the vehicles
 * 50017 to 50020, Command Team's own action, and Organizational Support 50014 / Front Organization 50028 as anything
 * but resources (unscripted, see `AOS_ASPECT_BASIC_SKIPPED`).
 */
const DEPS: EngineDeps = {
  abilities: mergeRegistries(
    WAVE8_ABILITIES,
    AOS_ASPECT_BASIC,
    MARIA_HILL_IDENTITY,
    MARIA_HILL_EVENTS,
    MARIA_HILL_SUPPORT_UPGRADES_ALLIES,
    MARIA_HILL_OBLIGATION_NEMESIS,
  ),
};

const SEARCH = "50001b.maria-hill-action";
const REASSIGN = "50001a.reassignment";
const SPECIAL_FUNDING = "50007.special-funding-response";
const FURY_RESPONSE = "50002.nick-fury-response";
const STAFF_RESOURCE = "50008.support-staff-resource";
const ILIAD = "50009.the-iliad-action";
const DIRECTOR = "50011.shield-director-action";
const DECOY = "50010.life-model-decoy-interrupt";
const PRESS_CONFERENCE = "50029.press-conference-action";

interface Plan {
  /** Optional triggers to take, by id suffix; every other optional trigger is declined. */
  readonly take?: readonly string[];
  /** Option labels (prefix match), consumed in order at successive option/card prompts. */
  readonly labels?: readonly string[];
  /** Instance ids to pick, in order, at successive target prompts. */
  readonly targets?: readonly string[];
  /** Instance ids to pick together at a card-choice prompt (every one of them that is offered). */
  readonly many?: readonly string[];
}
const planner = (plan: Plan): Picker => {
  const labels = [...(plan.labels ?? [])];
  const targets = [...(plan.targets ?? [])];
  return (s) => {
    const choice = s.pendingChoice!;
    const offered = choice.options.map((o) => o.optionId as string);
    switch (choice.prompt.kind) {
      case "chooseTriggers": {
        const hit = offered.find((o) => plan.take?.some((t) => o.endsWith(t)));
        return hit ? [hit] : [];
      }
      case "declareDefender":
        return ["decline"];
      case "discardDownToHandSize":
        return firstLegal(s);
      default: {
        if (plan.many && choice.prompt.kind === "chooseCards") return plan.many.filter((m) => offered.includes(m));
        if (targets[0] && offered.includes(targets[0])) return [targets.shift()!];
        const want = labels[0];
        const hit = want ? choice.options.find((o) => o.label.startsWith(want)) : undefined;
        if (hit) {
          labels.shift();
          return [hit.optionId];
        }
        return firstLegal(s);
      }
    }
  };
};

let state: GameState;
/** Runs commands (answering each prompt by `plan`) and returns only the events they produced. */
const act = (plan: Plan, ...commands: readonly Command[]): GameEvent[] => {
  const r = driveEventsPicking(DEPS, state, planner(plan), ...commands);
  state = r.state;
  return [...r.events];
};
const ofType = <T extends GameEvent["type"]>(events: readonly GameEvent[], type: T) =>
  events.filter((e): e is Extract<GameEvent, { type: T }> => e.type === type);

const code = (id: InstanceId): string => inst(state, id).cardId as string;
const handOf = (c: string): InstanceId[] => playerOf(state, P1).hand.filter((i) => code(i) === c);
const handCodes = (): string[] => playerOf(state, P1).hand.map(code);
const discardCodes = (): string[] => playerOf(state, P1).discard.map(code);
const inPlayAll = (c: string): InstanceId[] => cardsInPlay(state).filter((i) => code(i) === c);
const inPlayOf = (c: string): InstanceId | undefined => inPlayAll(c)[0];
const mustPlay = (c: string): InstanceId => {
  const id = inPlayOf(c);
  if (!id) throw new Error(`${c} is not in play`);
  return id;
};
const give = (...codes: string[]) => {
  state = moveToHand(state, P1, ...codes).state;
};
const stack = (...codes: string[]) => {
  state = stackEncounterDeck(state, ...codes);
};
/** Stages set-aside nemesis cards (in the order named, behind `fillers` Advance cards) for the next villain phase. */
const stageNemesis = (fillers: number, ...codes: string[]) => {
  let staged = state;
  for (const c of [...codes].reverse()) staged = stageNemesisCardForReveal(staged, c, P1, 0);
  state = stackEncounterDeck(staged, ...Array.from({ length: fillers }, () => "01186"));
};

const villain = (): InstanceId => state.activeVillainId!;
const mainScheme = (): InstanceId => state.mainScheme.instanceId;
const mainThreat = (): number => inst(state, mainScheme()).threat;
const damageOn = (id: InstanceId): number => inst(state, id).damage;
const countersOf = (id: InstanceId) => inst(state, id).counters;
const hill = (): InstanceId => identityOf(state);
/** The facedown Controlled minions in play (the player's own cards turned facedown). */
const controlledMinions = (): InstanceId[] => cardsInPlay(state).filter((i) => inst(state, i).facedownAs != null);

const changeForm = (): Command => ({ type: "changeForm", playerId: P1 });
const playFrom = (c: string, pay: readonly InstanceId[], extra: Parameters<typeof play>[3] = {}): Command =>
  play(P1, handOf(c)[0]!, pay, extra);
const staffPays = () => ({
  ability: { instanceId: mustPlay("50008"), abilityId: STAFF_RESOURCE as never },
});
const basicAttack = (by: InstanceId, target: InstanceId): Command => ({
  type: "basicAttack",
  playerId: P1,
  attackerInstanceId: by,
  targetInstanceId: target,
});
const basicThwart = (by: InstanceId, scheme: InstanceId): Command => ({
  type: "basicThwart",
  playerId: P1,
  thwarterInstanceId: by,
  schemeInstanceId: scheme,
});
const reassign = (plan: Plan) => act(plan, use(P1, hill(), REASSIGN));

// Instances the later rounds refer back to.
let staffId: InstanceId;
let command1: InstanceId;
let command2: InstanceId;
let furyId: InstanceId;
let iliadId: InstanceId;
let armyId: InstanceId;

describe("Maria Hill (Leadership) precon against Rhino (standard, solo), seed 1", () => {
  it("setup: 40-card legal deck with her off-aspect S.H.I.E.L.D. package, hand of 6 in alter-ego form", () => {
    // `mariaGame` builds the printed deck with `requireLegalDecks` on: the Bellerophon 50018, Douglass 50019 and
    // Pericles 50020 (Aggression, Justice and Protection supports) are legal only through 50001b's off-aspect package.
    state = mariaGame(1);
    const p = playerOf(state, P1);
    expect(p.identity.form).toBe("alterEgo");
    expect(p.hand).toHaveLength(6);
    expect(p.deck).toHaveLength(34);
    expect(p.discard).toHaveLength(0);
    expect(handCodes().sort()).toEqual(["50007", "50007", "50008", "50015", "50016", "50028"]);
    const all = [...p.hand, ...p.deck].map(code);
    for (const offAspect of ["50018", "50019", "50020"]) expect(all).toContain(offAspect);
    // The nemesis set is set aside, not in the encounter deck.
    expect(p.setAside.map(code).sort()).toEqual(["50030", "50031", "50032", "50033", "50033"]);
    expect(maxHitPoints(state, villain(), DEPS)).toBe(14);
    expect(mainThreat()).toBe(0);
    expect(state.round).toBe(1);
    expect(state.pendingChoice).toBeNull();
    // The box leaves only 50014 Organizational Support unscripted; the deck holds it and 50028 Front Organization,
    // and both are only ever resources here.
    expect(Object.keys(AOS_ASPECT_BASIC_SKIPPED)).toEqual(["50014.organizational-support-interrupt"]);
  });

  it("round 1, alter ego: the search takes The Iliad and shuffles; Support Staff enters with 3 staff", () => {
    const search = act({ labels: ["The Iliad"] }, use(P1, hill(), SEARCH));
    // RRG "Search" (p. 39): the deck is shuffled afterward.
    expect(ofType(search, "deckShuffled")).toHaveLength(1);
    expect(handCodes()).toContain("50009");
    expect(playerOf(state, P1).hand).toHaveLength(7);
    expect(playerOf(state, P1).deck).toHaveLength(33);
    expect(inst(state, hill()).exhausted).toBe(true);

    // Support Staff costs 1: one Front Organization (a resource here) pays. Uses (3 staff counters).
    const staff = act({}, playFrom("50008", [handOf("50028")[0]!]));
    expect(ofType(staff, "cardPlayed")).toMatchObject([{ resourcesPaid: 1 }]);
    staffId = mustPlay("50008");
    expect(countersOf(staffId)).toEqual({ staff: 3 });
    expect(inst(state, staffId).exhausted).toBe(false);
  });

  it("round 1: Special Funding pays Command Team's 2 and the support enters with 4 command counters", () => {
    const funded = act({ take: [SPECIAL_FUNDING] }, playFrom("50016", [handOf("50007")[0]!]));
    expect(ofType(funded, "cardPlayed")).toMatchObject([{ resourcesPaid: 2 }]);
    command1 = mustPlay("50016");
    // Uses (3 command counters) + 1 all-purpose counter placed after it entered play, retyped to command (RRG p. 6).
    expect(countersOf(command1)).toEqual({ command: 4 });
    expect(discardCodes()).toContain("50007");
    expect(handCodes().sort()).toEqual(["50007", "50009", "50015"]);
  });

  it("round 1 villain phase: Rhino schemes at the alter ego; Press Conference is given to her and stays in play", () => {
    // Boost Hydra Mercenary (1 icon), dealt the obligation.
    stack("01101", "50029");
    const events = act({}, endTurn());
    expect(ofType(events, "schemeResolved")).toMatchObject([{ baseSch: 1, boostIcons: 1, threatPlaced: 2 }]);
    expect(ofType(events, "encounterCardRevealed")).toMatchObject([{ cardId: "50029", playerId: P1 }]);
    expect(playerOf(state, P1).playArea.map(code)).toContain("50029");
    // Acceleration 1 + Rhino's scheme 1 + 1 boost icon.
    expect(mainThreat()).toBe(3);
    expect(state.round).toBe(2);
    // Alter-ego hand size 6: drew 3 back up from the 33 (30 left).
    expect(playerOf(state, P1).hand).toHaveLength(6);
    expect(playerOf(state, P1).deck).toHaveLength(30);
    expect(handCodes().sort()).toEqual(["50002", "50005", "50007", "50009", "50015", "50016"]);
  });

  it("round 2, hero form: Support Staff pays part of Nick Fury's 4; his thwart places a counter that is retyped", () => {
    act({}, changeForm());
    expect(playerOf(state, P1).identity.form).toBe("hero");
    // Maria Hill (hero) has the S.H.I.E.L.D. trait, so she may spend Support Staff: 1 wild + Reinforcements, Agents
    // of S.H.I.E.L.D. and the second Command Team as resources (1 icon each).
    const paid = act(
      {},
      playFrom("50002", [handOf("50005")[0]!, handOf("50015")[0]!, handOf("50016")[0]!], {
        abilities: [staffPays()],
      }),
    );
    expect(ofType(paid, "counterRemoved")).toMatchObject([{ instanceId: staffId, counterType: "staff", amount: 1 }]);
    expect(ofType(paid, "cardPlayed")).toMatchObject([{ resourcesPaid: 4 }]);
    expect(countersOf(staffId)).toEqual({ staff: 2 });
    expect(inst(state, staffId).exhausted).toBe(true);
    furyId = mustPlay("50002");

    // Nick Fury (THW 2): the main scheme's 3 becomes 1; consequential damage 1 on a thwart (RRG "Consequential Damage").
    const thwart = act({ take: [FURY_RESPONSE], targets: [staffId] }, basicThwart(furyId, mainScheme()));
    expect(ofType(thwart, "threatRemoved")).toMatchObject([{ schemeInstanceId: mainScheme(), amount: 2 }]);
    expect(mainThreat()).toBe(1);
    expect(damageOn(furyId)).toBe(1);
    // The response: 1 all-purpose counter on a S.H.I.E.L.D. support; Support Staff defines staff, so it is staff: 2 -> 3.
    expect(ofType(thwart, "counterAdded")).toMatchObject([{ instanceId: staffId, amount: 1 }]);
    expect(countersOf(staffId)).toEqual({ staff: 3 });
  });

  it("round 2: Maria attacks Rhino; Reassignment moves a command counter to Support Staff (retyped), once per round", () => {
    act({}, basicAttack(hill(), villain()));
    expect(damageOn(villain())).toBe(1); // ATK 1

    // Only a support holding a counter is a source; the destination is a different S.H.I.E.L.D. support.
    reassign({ targets: [command1, staffId] });
    expect(countersOf(command1)).toEqual({ command: 3 });
    expect(countersOf(staffId)).toEqual({ staff: 4 });

    // "(Limit once per round.)"
    const again = applyCommand(state, use(P1, hill(), REASSIGN), DEPS);
    expect(again.ok).toBe(false);
  });

  it("round 2 villain phase: Press Conference takes 1 counter off each support; Rhino attacks; Army reveals Controlled Innocents", () => {
    stageNemesis(1, "50031"); // one Advance (0 icons) is Rhino's boost, then Army of the Controlled
    const events = act({}, endTurn());
    // Forced Response, after the player phase ends: 1 counter from each support she controls.
    expect(ofType(events, "counterRemoved")).toMatchObject([
      { instanceId: staffId, counterType: "staff", amount: 1 },
      { instanceId: command1, counterType: "command", amount: 1 },
    ]);
    expect(countersOf(staffId)).toEqual({ staff: 3 });
    expect(countersOf(command1)).toEqual({ command: 2 });
    // Hero form: Rhino attacks (ATK 2 + 0 boost icons), undefended.
    expect(ofType(events, "enemyActivated")).toMatchObject([{ enemyInstanceId: villain(), activation: "attack" }]);
    expect(ofType(events, "damageDealt")).toMatchObject([{ targetInstanceId: hill(), amount: 2 }]);
    // Army of the Controlled: 3 threat (1 player), and its When Revealed found Controlled Innocents.
    armyId = mustPlay("50031");
    expect(inst(state, armyId).threat).toBe(3);
    expect(inPlayOf("50032")).toBeDefined();
    expect(mainThreat()).toBe(2); // 1 left + acceleration 1
    expect(state.round).toBe(3);
  });

  it("round 3, alter ego: Press Conference's Alter-Ego Action discards it; Special Funding and Support Staff pay The Iliad's 6", () => {
    act({}, changeForm());
    expect(playerOf(state, P1).identity.form).toBe("alterEgo");
    // Alter-Ego Action: exhaust the identity -> discard Press Conference.
    act({}, use(P1, inPlayOf("50029")!, PRESS_CONFERENCE));
    expect(inPlayOf("50029")).toBeUndefined();
    expect(inst(state, hill()).exhausted).toBe(true);

    // The Iliad (6): Special Funding 2 + Energy 2 + The Douglass 1 + Support Staff 1 (the alter ego has the trait too).
    give("50025");
    const iliad = act(
      { take: [SPECIAL_FUNDING] },
      playFrom("50009", [handOf("50007")[0]!, handOf("50025")[0]!, handOf("50019")[0]!], { abilities: [staffPays()] }),
    );
    expect(ofType(iliad, "cardPlayed")).toMatchObject([{ resourcesPaid: 6 }]);
    iliadId = mustPlay("50009");
    // Uses (3 mission) + Special Funding's counter.
    expect(countersOf(iliadId)).toEqual({ mission: 4 });
    expect(countersOf(staffId)).toEqual({ staff: 2 });
  });

  it("round 3: Nick Fury attacks Rhino and places a counter after that basic power too", () => {
    const events = act({ take: [FURY_RESPONSE], targets: [command1] }, basicAttack(furyId, villain()));
    expect(ofType(events, "damageDealt").filter((e) => e.targetInstanceId === villain())).toMatchObject([
      { amount: 2 },
    ]);
    expect(damageOn(villain())).toBe(3);
    expect(damageOn(furyId)).toBe(2); // consequential damage 1 on an attack
    expect(countersOf(command1)).toEqual({ command: 3 });
  });

  it("round 3 villain phase: Diabolical Discs takes a counter and makes a facedown Controlled minion; Controller follows (Surge)", () => {
    // Boost Advance, then Diabolical Discs (Surge), then Controller.
    stageNemesis(1, "50033", "50030");
    const events = act({ targets: [command1] }, endTurn());
    // Alter ego: Rhino schemes, 1 + 0.
    expect(ofType(events, "schemeResolved")).toMatchObject([{ baseSch: 1, boostIcons: 0, threatPlaced: 1 }]);
    expect(ofType(events, "encounterCardRevealed").map((e) => e.cardId)).toEqual(["50033", "50030"]);
    // When Revealed: 1 counter off a support of her choice (Command Team 3 -> 2), and with Controlled Innocents in play,
    // the top card of her deck facedown, engaged with her as a Controlled minion.
    expect(countersOf(command1)).toEqual({ command: 2 });
    const [minion] = controlledMinions();
    expect(controlledMinions()).toHaveLength(1);
    expect(inst(state, minion!).engagedWith).toBe(P1);
    expect(inst(state, minion!).ownerId).toBe(P1);
    expect(playerOf(state, P1).deck).not.toContain(minion);
    // Controlled Innocents: base SCH, ATK and hit points of 1.
    const profile = characterProfile(state, minion!, DEPS)!;
    expect([profile.atk, profile.sch, profile.maxHp]).toEqual([1, 1, 1]);
    expect(inPlayOf("50030")).toBeDefined();
    // 2 + acceleration 1 (main) + Army's acceleration 1 + Rhino's scheme 1.
    expect(mainThreat()).toBe(5);
    expect(damageOn(hill())).toBe(2);
    expect(state.round).toBe(4);
  });

  it("round 4, hero form: Life Model Decoy, S.H.I.E.L.D. Director and a second Command Team enter; the Director places a counter", () => {
    act({}, changeForm());
    give("50010", "50011", "50004", "50004", "50014", "50014", "50014");
    // Life Model Decoy (2): Support Staff 1 + Grant Ward 1.
    act({}, playFrom("50010", [handOf("50022")[0]!], { abilities: [staffPays()], attachToInstanceId: hill() }));
    expect(countersOf(staffId)).toEqual({ staff: 1 });
    expect(inst(state, staffId).exhausted).toBe(true);
    // S.H.I.E.L.D. Director (2): Victoria Hand 1 + Organizational Support 1.
    act({}, playFrom("50011", [handOf("50012")[0]!, handOf("50014")[0]!], { attachToInstanceId: hill() }));
    expect(inst(state, hill()).attachments.map(code).sort()).toEqual(["50010", "50011"]);
    // The second Command Team: two Organizational Support, 3 command counters.
    act({}, playFrom("50016", [handOf("50014")[0]!, handOf("50014")[1]!]));
    command2 = inPlayAll("50016").find((i) => i !== command1)!;
    expect(countersOf(command2)).toEqual({ command: 3 });
    // The Director: exhaust -> 1 all-purpose counter on a S.H.I.E.L.D. support, retyped to command.
    act({ targets: [command2] }, use(P1, mustPlay("50011"), DIRECTOR));
    expect(countersOf(command2)).toEqual({ command: 4 });
    expect(inst(state, mustPlay("50011")).exhausted).toBe(true);
  });

  it("round 4: The Iliad deals 5 to Rhino; On the Double's combined-cost cap of 6 leaves only one of Staff (1) and The Iliad (6)", () => {
    act({ labels: ["Deal 5"], targets: [villain()] }, use(P1, iliadId, ILIAD));
    expect(damageOn(villain())).toBe(8);
    expect(countersOf(iliadId)).toEqual({ mission: 3 });
    expect(inst(state, iliadId).exhausted).toBe(true);

    // Exhausted S.H.I.E.L.D. supports: Support Staff (cost 1) and The Iliad (cost 6): together 7 > 6.
    const played = applyCommand(state, play(P1, handOf("50004")[0]!, []), DEPS);
    if (!played.ok) throw new Error(played.error.message);
    state = played.state;
    const choice = state.pendingChoice!;
    expect(choice.prompt).toMatchObject({
      kind: "chooseCards",
      slot: "readied",
      maxTotal: { of: "printedCost", atMost: 6, values: { [staffId]: 1, [iliadId]: 6 } },
    });
    const both = applyCommand(
      state,
      { type: "resolveChoice", playerId: P1, choiceId: choice.choiceId, selectedOptionIds: [staffId, iliadId] },
      DEPS,
    );
    expect(both.ok).toBe(false);
    const one = applyCommand(
      state,
      { type: "resolveChoice", playerId: P1, choiceId: choice.choiceId, selectedOptionIds: [iliadId] },
      DEPS,
    );
    if (!one.ok) throw new Error(one.error.message);
    state = one.state;
    expect(state.pendingChoice).toBeNull();
    expect(inst(state, iliadId).exhausted).toBe(false);
    expect(inst(state, staffId).exhausted).toBe(true);
  });

  it("round 4: The Iliad removes 4 threat, On the Double again, then heals 3 from Maria; Reassignment empties it", () => {
    act({ labels: ["Remove 4"], targets: [mainScheme()] }, use(P1, iliadId, ILIAD));
    expect(mainThreat()).toBe(1);
    expect(countersOf(iliadId)).toEqual({ mission: 2 });
    act({ many: [iliadId] }, playFrom("50004", []));
    expect(inst(state, iliadId).exhausted).toBe(false);
    expect(damageOn(hill())).toBe(2);
    act({ labels: ["Heal 3"], targets: [hill()] }, use(P1, iliadId, ILIAD));
    expect(damageOn(hill())).toBe(0); // 3 heals the 2 there are
    expect(countersOf(iliadId)).toEqual({ mission: 1 });

    // Reassignment moves its last counter: The Iliad is emptied by the move and discarded (RRG "Uses", p. 46), and the
    // counter becomes a command counter on Command Team.
    const moved = reassign({ targets: [iliadId, command1] });
    expect(ofType(moved, "countersMoved")).toHaveLength(1);
    expect(inPlayOf("50009")).toBeUndefined();
    expect(discardCodes()).toContain("50009");
    expect(countersOf(command1)).toEqual({ command: 3 });

    act({}, basicAttack(hill(), villain()));
    expect(damageOn(villain())).toBe(9);
  });

  it("round 4 villain phase: Life Model Decoy prevents Rhino's attack; Controller removes a counter and makes a second minion", () => {
    // Rhino's boost card (0 icons; minions get none) and the dealt card, Advance.
    stack("01104", "01186");
    const events = act({ take: [DECOY], targets: [command1] }, endTurn());
    // Rhino's ATK 2 is all prevented; the Decoy discarded itself.
    expect(ofType(events, "damagePrevented")).toMatchObject([
      { targetInstanceId: hill(), amount: 2, reason: "effect" },
    ]);
    expect(inPlayOf("50010")).toBeUndefined();
    expect(discardCodes()).toContain("50010");
    // The first minion (ATK 1), Controller (ATK 1) and the new minion (ATK 1) hit Maria, unprevented.
    const hits = ofType(events, "damageDealt").filter((e) => e.targetInstanceId === hill());
    expect(hits.map((e) => e.amount)).toEqual([1, 1, 1]);
    expect(damageOn(hill())).toBe(3);
    // Controller's Forced Response: 1 counter off a support of her choice (Command Team 3 -> 2), and with Controlled
    // Innocents in play a second facedown minion.
    expect(countersOf(command1)).toEqual({ command: 2 });
    expect(controlledMinions()).toHaveLength(2);
    expect(countersOf(staffId)).toEqual({ staff: 1 });
    expect(mainThreat()).toBe(4); // 1 + acceleration 2 + the dealt Advance
    expect(state.round).toBe(5);
  });

  it("round 5: Reinforcements puts a counter on each of two supports (cost 4, under the cap of 6)", () => {
    give("50003", "50005", "50006", "50028", "50028", "50027");
    expect(countersOf(command1)).toEqual({ command: 2 });
    act({ many: [command1, command2] }, playFrom("50005", [handOf("50028")[0]!]));
    expect(countersOf(command1)).toEqual({ command: 3 });
    expect(countersOf(command2)).toEqual({ command: 5 });
    expect(countersOf(staffId)).toEqual({ staff: 1 });
  });

  it("round 5: All-Points Bulletin with three supports mixes the options; a defeated Controlled minion places 1 threat", () => {
    // The seed makes one of the two facedown minions a copy of All-Points Bulletin itself (top of her deck): hit that one.
    const minions = controlledMinions();
    const minionA = minions.find((i) => code(i) === "50003") ?? minions[0]!;
    const mainBefore = mainThreat();
    const events = act(
      { labels: ["Remove 1", "Deal 1", "Deal 1"], targets: [armyId, villain(), minionA] },
      playFrom("50003", [handOf("50027")[0]!]),
    );
    expect(ofType(events, "cardPlayed")).toMatchObject([{ resourcesPaid: 2 }]);
    // Three S.H.I.E.L.D. supports (Staff, both Command Teams): thwart Army, hit Rhino, hit the minion (1 hit point).
    expect(ofType(events, "threatRemoved")).toMatchObject([{ schemeInstanceId: armyId, amount: 1 }]);
    expect(ofType(events, "damageDealt").map((e) => [e.targetInstanceId, e.amount])).toEqual([
      [villain(), 1],
      [minionA, 1],
    ]);
    expect(damageOn(villain())).toBe(10);
    expect(inst(state, armyId).threat).toBe(2);
    // Controlled Innocents: the defeated minion goes to its owner's discard pile and 1 threat goes on the main scheme.
    expect(ofType(events, "characterDefeated")).toMatchObject([{ instanceId: minionA }]);
    expect(playerOf(state, P1).discard).toContain(minionA);
    expect(mainThreat()).toBe(mainBefore + 1);
    expect(controlledMinions()).toHaveLength(1);
  });

  it("round 5: The Hard Call pays with Support Staff's last counter (discarded) and discards Command Team for 2 to each enemy", () => {
    const minionB = controlledMinions()[0]!;
    const controller = mustPlay("50030");
    const mainBefore = mainThreat();
    const events = act(
      {},
      playFrom("50006", [handOf("50028")[0]!], { abilities: [staffPays()], costChoices: { discarded: [command1] } }),
    );
    // Support Staff's last counter was removed as part of the payment: Uses (RRG p. 46) discards it.
    expect(inPlayOf("50008")).toBeUndefined();
    expect(discardCodes()).toContain("50008");
    // RRG "Printed" (p. 35): Command Team's printed cost is 2, whatever counters it held.
    expect(inPlayAll("50016")).toEqual([command2]);
    // Each enemy takes 2, whatever order they are dealt in.
    expect(
      ofType(events, "damageDealt")
        .map((e) => `${e.targetInstanceId}:${e.amount}`)
        .sort(),
    ).toEqual([`${villain()}:2`, `${controller}:2`, `${minionB}:2`].sort());
    expect(damageOn(villain())).toBe(12);
    expect(damageOn(controller)).toBe(2);
    expect(ofType(events, "characterDefeated")).toMatchObject([{ instanceId: minionB }]);
    expect(mainThreat()).toBe(mainBefore + 1);
    expect(controlledMinions()).toHaveLength(0);
  });

  it("round 5: a one-support All-Points Bulletin and a basic attack defeat Rhino (I); the stage advances", () => {
    // The first All-Points Bulletin is in her discard pile; the one defeated minion may have been the second (see above).
    give("50003");
    const spare = playerOf(state, P1).hand.filter((i) => !["50003", "50025", "50026", "50027"].includes(code(i)));
    const apb = act({ labels: ["Deal 1"], targets: [villain()] }, playFrom("50003", spare.slice(0, 2)));
    // One S.H.I.E.L.D. support left (the second Command Team): one choice.
    expect(ofType(apb, "cardPlayed")).toMatchObject([{ resourcesPaid: 2 }]);
    expect(ofType(apb, "damageDealt")).toMatchObject([{ targetInstanceId: villain(), amount: 1 }]);
    expect(damageOn(villain())).toBe(13);
    const events = act({}, basicAttack(hill(), villain()));
    expect(ofType(events, "villainStageAdvanced")).toMatchObject([{ stageIndex: 1 }]);
    expect(damageOn(villain())).toBe(0);
    expect(state.outcome).toBeNull();
  });

  it("invariants: no pending choice, no card in two zones, hand + deck + discard + in play = 40 of her cards", () => {
    const p = playerOf(state, P1);
    expect(state.pendingChoice).toBeNull();
    const attached = inst(state, p.identity.instanceId).attachments;
    // The play area also holds encounter cards (Army, Controlled Innocents, Controller): only her own are counted.
    const inPlayMine = [...p.playArea, ...attached].filter((i) => inst(state, i).ownerId === P1);
    const zones = [...p.hand, ...p.deck, ...p.discard, ...inPlayMine];
    expect(new Set(zones).size).toBe(zones.length);
    expect(zones).toHaveLength(40);
    for (const id of zones) expect(inst(state, id).ownerId).toBe(P1);
    expect(inPlayMine.map(code).sort()).toEqual(["50002", "50011", "50016"]);
  });
});

describe("Maria Hill gives her allies the S.H.I.E.L.D. trait in hero form only (Agents of S.H.I.E.L.D. reads it)", () => {
  const AGENTS = "50015";
  const AGENTS_INTERRUPT = "50015.agents-of-shield-constant";
  /** A non-S.H.I.E.L.D. Core ally (Black Cat 01002) swapped in for one deck card, and put into play with Agents. */
  const staged = (hero: boolean): GameState => {
    let s = mariaGame(1, { "50028": "01002" });
    s = inPlay(s, AGENTS).state;
    s = inPlay(s, "01002").state;
    return hero ? withForm(s, { heroForm: 0 }) : s;
  };
  const offered = (s: GameState): readonly string[] => {
    const r = applyCommand(stackEncounterDeck(s, "01186", "01105", "01104"), endTurn(), DEPS);
    if (!r.ok) throw new Error(r.error.message);
    const next = settle(
      r.state,
      (x) => (x.pendingChoice!.prompt.kind === "declareDefender" ? ["decline"] : firstLegal(x)),
      (x) => x.pendingChoice?.prompt.kind === "chooseTriggers",
      DEPS,
    );
    return next.pendingChoice?.options.map((o) => o.optionId as string) ?? [];
  };

  it("hero form: the Core ally counts as S.H.I.E.L.D., so every character has the trait and Agents may cancel a card", () => {
    expect(offered(staged(true)).some((o) => o.endsWith(AGENTS_INTERRUPT))).toBe(true);
  });
  it("alter-ego form: the trait is printed on the hero face only, so Black Cat is not S.H.I.E.L.D. and Agents is not offered", () => {
    expect(offered(staged(false)).some((o) => o.endsWith(AGENTS_INTERRUPT))).toBe(false);
  });
});

describe("doubts found while writing the game", () => {
  // Round 4: a Controlled minion made by Controller's Forced Response during step 2 of the villain phase attacked in
  // the same phase. That is the rule (RRG 1.8 "Minion": "If a minion engages a player during an enemy activation in
  // which all minions engaged with that player are instructed to activate ... the newly-engaged minion will also
  // activate"), and the game above asserts its 1 damage.
  // Observed in rounds 4 and 5: the option labels of target prompts name the facedown minion's hidden card ("Agents of
  // S.H.I.E.L.D.", "Reinforcements"). A facedown card has no name; the label should not leak the card.
  it.todo("a facedown Controlled minion is offered as a target without naming the card it was");
});
