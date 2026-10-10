import { AOS_CARDS, CORE_CARDS } from "@mc/content";
import {
  cardsInPlay,
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
  stackEncounterDeck,
  use,
  type Picker,
} from "../../../testing/harness.js";
import { driveEventsPicking } from "../../../testing/staging.js";
import { WAVE8_ABILITIES } from "../../../wave8/index.js";
import { AOS_ASPECT_BASIC } from "../aspect-basic.js";
import { NICK_FURY_EVENTS } from "./events.js";
import { NICK_FURY_IDENTITY } from "./identity.js";
import { NICK_FURY_OBLIGATION_NEMESIS } from "./obligation-nemesis.js";
import { NICK_FURY_SUPPORT_UPGRADES_ALLIES } from "./support-upgrades-allies.js";
import { furyGame, suitOf } from "./testing.js";

vi.setConfig({ testTimeout: 240_000 });

/**
 * Whole-game test for Nick Fury's printed precon (`nick-fury-justice`, cards 50034-50058) against Core's Rhino
 * (standard, solo), docs/phase7-wave9.md section 8.4 ("Nick Fury starter deck e2e"). Five rounds played through the
 * engine's real commands, one decision at a time, ending with Rhino's stage I defeated. Only the deck order and the
 * encounter deck are seeded (the cards a round needs are moved from the deck or discard pile into hand with
 * `moveToHand`, as the other kit tests do; the encounter cards of a villain phase are stacked with `stackEncounterDeck`);
 * every play, ability and attack is a command the engine validates. Deterministic by seed (1).
 *
 * Rules the game leans on (RRG 1.8 = mc_rulesreference_v18_compressed.md):
 * - Villain phase (Appendix II, pp. 51-52): step 1 threat on the main scheme, step 2 the villain then the minions
 *   activate (an enemy attacks a hero-form identity and schemes against an alter-ego one, "Activation", p. 6), step 3
 *   deal, step 4 reveal. "End of Player Phase" (p. 18): discard, draw up to hand size, ready all cards, before the
 *   villain phase, so a character that has not defended can defend.
 * - Stealth 50035b (MC50 p. 22, RRG FAQ "Stealth (#35)" p. 65): in hero form an enemy that would attack Nick Fury
 *   schemes instead and 1 threat of that activation goes on the suit form upgrade (5 or less there).
 * - Break Cover 50034a then Assault 50035a on the same attack: Forced resolves before the optional interrupt (RRG "Forced",
 *   p. 20), so an attack that breaks cover from Stealth can spend the banked threat.
 * - "Up to" in a cost needs at least one (RRG "Cost", p. 14); Toughness (RRG "Toughness"/"Status Cards") spends the tough
 *   card instead of taking the damage.
 *
 * Not exercised here (covered by the kit tests in this folder): Eyepatch Camera 50043, Intelligence Analysis 50045,
 * Secret Agent 50046, Super Spies 50024, and the six Justice/basic cards left in hand. Intelligence 50051 (three
 * copies in the deck) is skipped in `AOS_ASPECT_BASIC_SKIPPED`, so it is only ever used as a resource here.
 */
const DEPS: EngineDeps = {
  abilities: mergeRegistries(
    WAVE8_ABILITIES,
    AOS_ASPECT_BASIC,
    NICK_FURY_IDENTITY,
    NICK_FURY_EVENTS,
    NICK_FURY_SUPPORT_UPGRADES_ALLIES,
    NICK_FURY_OBLIGATION_NEMESIS,
  ),
};

const ASSAULT = "50035a.assault-interrupt";
const GATHER_INTEL = "50034a.star-gather-intel";
const HILL = "50036.maria-hill-interrupt";
const SHIELD = "50042.em-shield-interrupt";

interface Plan {
  /** Optional triggers to take, by id suffix; every other optional trigger is declined. */
  readonly take?: readonly string[];
  readonly number?: number;
  /** An option whose label starts with this text. */
  readonly option?: string;
  readonly target?: string;
}
const planner =
  (plan: Plan): Picker =>
  (s) => {
    const choice = s.pendingChoice!;
    const offered = choice.options.map((o) => o.optionId as string);
    switch (choice.prompt.kind) {
      case "chooseTriggers": {
        const hit = offered.find((o) => plan.take?.some((t) => o.endsWith(t)));
        return hit ? [hit] : [];
      }
      case "chooseNumber":
        return [String(plan.number ?? choice.prompt.max)];
      case "declareDefender":
        return ["decline"];
      case "chooseOption": {
        const hit = plan.option ? choice.options.find((o) => o.label.startsWith(plan.option!)) : undefined;
        return hit ? [hit.optionId] : firstLegal(s);
      }
      case "chooseTarget":
        return plan.target && offered.includes(plan.target) ? [plan.target] : firstLegal(s);
      default:
        return firstLegal(s);
    }
  };

let state: GameState;
let log: GameEvent[] = [];
/** Runs commands (answering each prompt by `plan`) and returns only the events they produced. */
const act = (plan: Plan, ...commands: readonly Command[]): GameEvent[] => {
  const r = driveEventsPicking(DEPS, state, planner(plan), ...commands);
  state = r.state;
  log = [...log, ...r.events];
  return [...r.events];
};
const ofType = <T extends GameEvent["type"]>(events: readonly GameEvent[], type: T) =>
  events.filter((e): e is Extract<GameEvent, { type: T }> => e.type === type);

const handOf = (code: string): InstanceId[] =>
  playerOf(state, P1).hand.filter((i) => (inst(state, i).cardId as string) === code);
const inPlayOf = (code: string): InstanceId | undefined =>
  cardsInPlay(state).find((i) => (inst(state, i).cardId as string) === code);
const mustPlay = (code: string): InstanceId => {
  const id = inPlayOf(code);
  if (!id) throw new Error(`${code} is not in play`);
  return id;
};
const give = (...codes: string[]) => {
  state = moveToHand(state, P1, ...codes).state;
};
const stack = (...codes: string[]) => {
  state = stackEncounterDeck(state, ...codes);
};

const villain = (): InstanceId => state.activeVillainId!;
const suit = (): InstanceId => suitOf(state)!;
const suitThreat = (): number => inst(state, suit()).threat;
const showsStealth = (): boolean => inst(state, suit()).flipped;
const mainThreat = (): number => inst(state, state.mainScheme.instanceId).threat;
const damageOn = (id: InstanceId): number => inst(state, id).damage;
const handNames = (): string[] =>
  playerOf(state, P1).hand.map((i) => [...AOS_CARDS, ...CORE_CARDS].find((c) => c.id === inst(state, i).cardId)!.name);

const thwartBy = (by: InstanceId): Command => ({
  type: "basicThwart",
  playerId: P1,
  thwarterInstanceId: by,
  schemeInstanceId: state.mainScheme.instanceId,
});
const attackWith = (target: InstanceId): Command => ({
  type: "basicAttack",
  playerId: P1,
  attackerInstanceId: identityOf(state),
  targetInstanceId: target,
});
const changeForm = (): Command => ({ type: "changeForm", playerId: P1 });
const ability = (id: InstanceId, ref: string): Command => use(P1, id, ref);
const playFrom = (code: string, pay: readonly InstanceId[], extra: Parameters<typeof play>[3] = {}): Command =>
  play(P1, handOf(code)[0]!, pay, extra);
const attachedToMe = () => ({ attachToInstanceId: identityOf(state) });
/** Pays with Fury's Watch: exhaust it and remove `n` threat from the suit for `n` mental resources. */
const watch = (n: number) => ({
  ability: {
    instanceId: mustPlay("50044"),
    abilityId: "50044.furys-watch-resource" as never,
    costSelection: { removeThreat: n },
  },
});

describe("Nick Fury (Justice) precon against Rhino (standard, solo), seed 1", () => {
  it("setup: 40-card deck, hand of 6 in alter-ego form, Assault set up faceup by Suit Up, uncounted and permanent", () => {
    state = furyGame();
    const p = playerOf(state, P1);
    expect(p.identity.form).toBe("alterEgo");
    // RRG "Setup": the hand is drawn from the 40-card deck; Assault 50035a is Permanent and is not one of the 40.
    expect(p.hand).toHaveLength(6);
    expect(p.deck).toHaveLength(34);
    expect(p.discard).toHaveLength(0);
    const everywhere = [...p.hand, ...p.deck, ...p.discard];
    expect(everywhere.some((i) => (inst(state, i).cardId as string) === "50035a")).toBe(false);
    // Suit Up: Assault in play, attached to the identity, front face showing, no threat.
    expect(suit()).toBeDefined();
    expect(inst(state, suit()).attachedTo).toBe(identityOf(state));
    expect(inst(state, suit()).faceup).toBe(true);
    expect(showsStealth()).toBe(false);
    expect(suitThreat()).toBe(0);
    // Rhino (I): 14 hit points for one player; the main scheme starts empty.
    expect(maxHitPoints(state, villain(), DEPS)).toBe(14);
    expect(mainThreat()).toBe(0);
    expect(state.pendingChoice).toBeNull();
  });

  it("round 1, alter ego: Infiltrate shows Stealth; Safe House #221 puts 1 threat on the suit", () => {
    const infiltrate = act({}, use(P1, identityOf(state), "50034b.infiltrate"));
    expect(ofType(infiltrate, "additionalFormChanged")).toMatchObject([{ formType: "suit", formName: "Stealth" }]);
    expect(showsStealth()).toBe(true);
    expect(playerOf(state, P1).identity.form).toBe("alterEgo");

    // Safe House #221 costs 1: one Informant (a resource) pays.
    act({}, playFrom("50041", [handOf("50050")[0]!]));
    const house = mustPlay("50041");
    const placed = act({ option: "Place 1 threat" }, ability(house, "50041.safe-house-221-action"));
    expect(ofType(placed, "threatPlaced")).toMatchObject([{ schemeInstanceId: suit(), amount: 1 }]);
    expect(suitThreat()).toBe(1);
    expect(inst(state, house).exhausted).toBe(true);
  });

  it("round 1 villain phase: alter ego is schemed against (not attacked), Stealth does not apply", () => {
    // Boost Hydra Mercenary (1 icon), dealt Shocker (When Revealed: 1 damage to each hero; an alter ego is not a hero).
    stack("01101", "01103");
    const events = act({}, endTurn());
    // RRG "Villain Phase" step 2 (p. 52): an alter-ego identity is schemed against.
    const scheme = ofType(events, "schemeResolved");
    expect(scheme).toHaveLength(1);
    expect(scheme[0]).toMatchObject({ baseSch: 1, boostIcons: 1, threatPlaced: 2 });
    expect(scheme[0]!.diverted).toBeUndefined(); // Stealth is "Forced Interrupt (Hero)"
    expect(ofType(events, "enemyActivated")).toMatchObject([{ activation: "scheme" }]);
    // Round 2 begins: accel 1 + Rhino's scheme 1 + 1 boost icon = 3 on the main scheme; the suit is untouched.
    expect(state.round).toBe(2);
    expect(mainThreat()).toBe(3);
    expect(suitThreat()).toBe(1);
    expect(damageOn(identityOf(state))).toBe(0);
    expect(inst(state, inPlayOf("01103")!).engagedWith).toBe(P1);
    // Alter ego hand size 6: drew back up to 6.
    expect(playerOf(state, P1).hand).toHaveLength(6);
    expect(playerOf(state, P1).deck).toHaveLength(32);
  });

  it("round 2, hero form: Maria Hill thwarts (suit +2), Fury's Gather Intel after a basic thwart (+1)", () => {
    const flipped = act({}, changeForm());
    expect(ofType(flipped, "formChanged")).toMatchObject([{ to: "hero" }]);
    // Maria Hill (cost 3) paid with the two Informants and Practiced Plan; Flying Car, EM Shield and Covert stay.
    give("50036");
    act({}, playFrom("50036", [...handOf("50050"), handOf("50058")[0]!]));
    const hill = mustPlay("50036");
    expect(handNames().sort()).toEqual(["Covert Surveillance", "EM Shield", "Fury's Flying Car"]);

    // Maria Hill's Interrupt: the threat she removes (THW 2 of the main scheme's 3) goes on the suit as well.
    const hillThwart = act({ take: [HILL] }, thwartBy(hill));
    expect(ofType(hillThwart, "threatRemoved")).toMatchObject([
      { schemeInstanceId: state.mainScheme.instanceId, amount: 2 },
    ]);
    expect(mainThreat()).toBe(1);
    expect(suitThreat()).toBe(3);
    // Consequential damage 1 for a thwart (RRG "Consequential Damage"): Maria Hill (3 hit points) is hurt.
    expect(damageOn(hill)).toBe(1);

    // Gather Intel: after Fury's own basic thwart, 1 threat on the suit. Only 1 is left to remove.
    const intel = act({ take: [GATHER_INTEL] }, thwartBy(identityOf(state)));
    expect(ofType(intel, "threatRemoved")).toMatchObject([{ amount: 1 }]);
    expect(ofType(intel, "threatPlaced")).toMatchObject([{ schemeInstanceId: suit(), amount: 1 }]);
    expect(mainThreat()).toBe(0);
    expect(suitThreat()).toBe(4);
    expect(showsStealth()).toBe(true);
  });

  it("round 2 villain phase in Stealth: both attacks become schemes and 1 threat of each goes on the suit", () => {
    // Boosts: Hydra Mercenary (1 icon) for Rhino, Hard to Keep Down (0) for Shocker; dealt Advance (the villain
    // schemes, an ordinary scheme: nothing diverted) with Hard to Keep Down (0) as its boost.
    stack("01101", "01104", "01186", "01104");
    const events = act({}, endTurn());
    const schemes = ofType(events, "schemeResolved");
    expect(schemes).toHaveLength(3);
    // Rhino and Shocker were both activated as attacks (the engine re-initiates them as schemes).
    expect(ofType(events, "enemyActivated").map((e) => e.activation)).toEqual(["attack", "attack"]);
    const [rhino, shocker, advance] = schemes;
    // Rhino SCH 1 + 1 boost icon = 2: one goes to Stealth (suit 4 -> 5), one to the main scheme.
    expect(rhino).toMatchObject({
      baseSch: 1,
      boostIcons: 1,
      threatPlaced: 1,
      diverted: { toInstanceId: suit(), amount: 1 },
    });
    // Shocker SCH 1 + 0 = 1: it is all diverted (the suit has 5, "5 or less"), nothing on the main scheme.
    expect(shocker).toMatchObject({
      baseSch: 1,
      boostIcons: 0,
      threatPlaced: 0,
      diverted: { toInstanceId: suit(), amount: 1 },
    });
    expect(shocker!.enemyInstanceId).toBe(inPlayOf("01103"));
    // Advance: not an attack, so Stealth has nothing to replace.
    expect(advance!.diverted).toBeUndefined();
    expect(advance).toMatchObject({ baseSch: 1, boostIcons: 0, threatPlaced: 1 });
    expect(damageOn(identityOf(state))).toBe(0);
    expect(suitThreat()).toBe(6);
    expect(mainThreat()).toBe(3); // accel 1 + Rhino 1 + Shocker 0 + Advance 1
    expect(showsStealth()).toBe(true);
    expect(state.round).toBe(3);
    expect(playerOf(state, P1).hand).toHaveLength(5); // hero hand size 5
  });

  it("round 3: Covert Surveillance in Stealth banks 2; the attack breaks cover and spends 3 through Assault (+3 damage)", () => {
    give("50044", "50037", "50049", "50049", "50049", "50058");
    // Fury's Watch (cost 1, an upgrade attached to the identity) paid with Intelligence.
    act({}, playFrom("50044", [handOf("50051")[0]!], attachedToMe()));
    // Covert Surveillance (cost 1) paid with Intelligence Analysis: in Stealth, the 2 threat removed may go on the suit.
    const covert = act({ option: "Place that threat" }, playFrom("50038", [handOf("50045")[0]!]));
    expect(ofType(covert, "threatRemoved")).toMatchObject([{ amount: 2 }]);
    expect(mainThreat()).toBe(1);
    expect(suitThreat()).toBe(8);
    expect(showsStealth()).toBe(true); // already in Stealth: no change

    const events = act({ take: [ASSAULT], number: 3 }, attackWith(villain()));
    // Break Cover (Forced Interrupt) first: Assault shows, so its optional interrupt is offered on this attack.
    expect(ofType(events, "additionalFormChanged")).toMatchObject([{ formType: "suit", formName: "Assault" }]);
    expect(showsStealth()).toBe(false);
    expect(ofType(events, "threatRemoved")).toMatchObject([{ schemeInstanceId: suit(), amount: 3 }]);
    // ATK 2 + 3 additional damage.
    expect(ofType(events, "damageDealt")).toMatchObject([{ targetInstanceId: villain(), amount: 5 }]);
    expect(damageOn(villain())).toBe(5);
    expect(suitThreat()).toBe(5);
    expect(inst(state, identityOf(state)).exhausted).toBe(true);
  });

  it("round 3: Fury's Flying Car (1 threat) readies Fury; a second basic thwart gathers intel", () => {
    const [a, b] = handOf("50049");
    act({}, playFrom("50040", [a!, b!]));
    const car = mustPlay("50040");
    act({}, ability(car, "50040.furys-flying-car-action"));
    expect(suitThreat()).toBe(4);
    expect(inst(state, car).exhausted).toBe(true);
    expect(inst(state, identityOf(state)).exhausted).toBe(false);
    const events = act({ take: [GATHER_INTEL] }, thwartBy(identityOf(state)));
    expect(ofType(events, "threatRemoved")).toMatchObject([{ amount: 1 }]);
    expect(mainThreat()).toBe(0);
    expect(suitThreat()).toBe(5);
  });

  it("round 3: Fury's Watch pays for Concentrated Fire with 2 threat; the defeat of Shocker places its printed SCH", () => {
    // EM Shield (cost 2): Global Logistics and Practiced Plan.
    act({}, playFrom("50042", [handOf("50049")[0]!, handOf("50058")[0]!], attachedToMe()));
    expect(inPlayOf("50042")).toBeDefined();

    const shocker = inPlayOf("01103")!;
    const events = act({ target: shocker, option: "Place threat" }, playFrom("50037", [], { abilities: [watch(2)] }));
    expect(ofType(events, "resourcesGenerated")).toMatchObject([{ instanceId: mustPlay("50044"), amount: 2 }]);
    expect(ofType(events, "cardPlayed")).toMatchObject([{ resourcesPaid: 2 }]);
    expect(inst(state, mustPlay("50044")).exhausted).toBe(true);
    // 4 damage to Shocker (3 hit points) defeats it; its printed SCH 1 goes on the suit (5 - 2 paid + 1 = 4).
    expect(ofType(events, "characterDefeated")).toMatchObject([{ instanceId: shocker }]);
    expect(inPlayOf("01103")).toBeUndefined();
    expect(suitThreat()).toBe(4);
    expect(damageOn(villain())).toBe(5); // the attack was at Shocker, not Rhino
  });

  it("round 3 villain phase: EM Shield prevents Rhino's attack; Discovered turns the suit's 4 threat into 4 damage", () => {
    // Rhino's boost: Caught Off Guard (1 icon), so the attack is 2 + 1; dealt Discovered (the obligation).
    stack("01188", "50059");
    const events = act({ take: [SHIELD], option: "Take 1 damage" }, endTurn());
    expect(ofType(events, "enemyActivated")).toMatchObject([{ enemyInstanceId: villain(), activation: "attack" }]);
    // Assault is showing, so Rhino attacks (Stealth is not): EM Shield discards itself, preventing all 3.
    expect(ofType(events, "damagePrevented")).toMatchObject([
      { targetInstanceId: identityOf(state), amount: 3, reason: "effect" },
    ]);
    expect(inPlayOf("50042")).toBeUndefined();
    // Discovered: 4 threat on the suit -> the player chose 4 damage (not an attack, so EM Shield could not stop it).
    const hurt = ofType(events, "damageDealt").filter((e) => e.targetInstanceId === identityOf(state));
    expect(hurt).toMatchObject([{ amount: 4 }]);
    expect(damageOn(identityOf(state))).toBe(4);
    expect(suitThreat()).toBe(4); // taking the damage leaves the threat
    expect(showsStealth()).toBe(false);
    expect(state.round).toBe(4);
  });

  it("round 4, alter ego: Infiltrate again, Recover 4 heals all 4 damage, Safe House banks 1", () => {
    act({}, changeForm());
    expect(playerOf(state, P1).identity.form).toBe("alterEgo");
    act({}, use(P1, identityOf(state), "50034b.infiltrate"));
    expect(showsStealth()).toBe(true);
    const recovered = act({}, { type: "basicRecover", playerId: P1 });
    expect(damageOn(identityOf(state))).toBe(0); // REC 4
    expect(recovered.some((e) => e.type === "damageDealt")).toBe(false);
    act({ option: "Place 1 threat" }, ability(mustPlay("50041"), "50041.safe-house-221-action"));
    expect(suitThreat()).toBe(5);
  });

  it("round 4 villain phase: Rhino schemes at the alter ego; Sandman arrives engaged with a tough status card", () => {
    // Boost Hard to Keep Down (0 icons), dealt Sandman (Toughness).
    stack("01104", "01102");
    act({}, endTurn());
    const sandman = inPlayOf("01102")!;
    expect(inst(state, sandman).engagedWith).toBe(P1);
    expect(inst(state, sandman).statuses.tough).toBe(1);
    expect(mainThreat()).toBe(3); // 1 left after round 3 + accel 1 + Rhino SCH 1 + 0 boost icons (alter ego: a scheme)
    expect(state.round).toBe(5);
  });

  it("round 5: Spray Fire from Stealth (Watch pays 2) breaks cover and spends 3; Sandman only loses its tough card", () => {
    act({}, changeForm());
    expect(showsStealth()).toBe(true);
    give("50039", "50037", "50049", "50050");
    const sandman = inPlayOf("01102")!;
    const events = act(
      { take: [ASSAULT], number: 3 },
      playFrom("50039", [handOf("50049")[0]!], { abilities: [watch(2)] }),
    );
    expect(ofType(events, "additionalFormChanged")).toMatchObject([{ formName: "Assault" }]);
    expect(ofType(events, "threatRemoved").map((e) => e.amount)).toEqual([2, 3]);
    expect(suitThreat()).toBe(0);
    // Rhino: Spray Fire's 3 damage + 3 from Assault (5 + 6).
    expect(damageOn(villain())).toBe(11);
    // Sandman: the 3 damage is absorbed by Toughness (RRG "Toughness"): no damage, the status card is gone.
    expect(inst(state, sandman).statuses.tough).toBe(0);
    expect(damageOn(sandman)).toBe(0);
  });

  it("round 5: Concentrated Fire defeats Rhino (I); the stage advances and its printed SCH goes on the suit", () => {
    const events = act(
      { option: "Place threat", target: villain() },
      playFrom("50037", [handOf("50050")[0]!, handOf("50051")[0]!]),
    );
    // Suit is empty, so Assault's "up to" cost (at least 1) is not offered; 11 + 4 = 15 >= 14.
    expect(ofType(events, "threatRemoved")).toEqual([]);
    expect(ofType(events, "villainStageAdvanced")).toMatchObject([{ stageIndex: 1 }]);
    expect(state.outcome).toBeNull();
    expect(damageOn(villain())).toBe(0);
    expect(suitThreat()).toBe(1); // Rhino (I) printed SCH 1
  });

  it("invariants: no card in two zones, 40 counted cards plus the uncounted suit, no unresolved prompt", () => {
    const p = playerOf(state, P1);
    expect(state.pendingChoice).toBeNull();
    const attachedToIdentity = inst(state, p.identity.instanceId).attachments;
    // The play area also holds the engaged encounter minion (Sandman), which is not one of this deck's cards.
    const inPlay = [...p.playArea, ...attachedToIdentity].filter((i) => inst(state, i).ownerId === P1);
    const zones = [...p.hand, ...p.deck, ...p.discard, ...inPlay];
    expect(new Set(zones).size).toBe(zones.length);
    // The 40-card deck, after setup, is deck + hand + discard + in play, plus the Permanent Assault in play.
    expect(zones).toHaveLength(41);
    expect(inPlay).toContain(suit());
    for (const id of zones) expect(inst(state, id).ownerId).toBe(P1);
  });
});
