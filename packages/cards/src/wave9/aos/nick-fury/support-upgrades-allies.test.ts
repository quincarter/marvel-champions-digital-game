import { AOS_CARDS, cardId, type AllyCard, type SupportCard, type UpgradeCard } from "@mc/content";
import {
  activeEncounterDeckId,
  applyCommand,
  paymentFor,
  traitsOf,
  type Command,
  type GameEvent,
  type GameState,
  type InstanceId,
  type Payment,
} from "@mc/engine";
import { describe, expect, it, vi } from "vitest";
import { abilityRefIds } from "../../../ability-refs.js";
import { validateDefinition } from "../../../dsl/validate.js";
import {
  P1,
  endTurn,
  firstLegal,
  identityOf,
  inst,
  moveToHand,
  patchInstance,
  payWith,
  play,
  playerOf,
  use,
  type Picker,
} from "../../../testing/harness.js";
import { driveEventsPicking } from "../../../testing/staging.js";
import { NICK_FURY_OBLIGATION_NEMESIS } from "./obligation-nemesis.js";
import {
  NICK_FURY_SUPPORT_UPGRADES_ALLIES as REGISTRY,
  NICK_FURY_SUPPORT_UPGRADES_ALLIES_SKIPPED as SKIPPED,
} from "./support-upgrades-allies.js";
import { FURY_KIT_DEPS, engageMinion, furyGame, furyHeroGame, stagedInPlay, suitOf } from "./testing.js";
import { mergeRegistries } from "../../../dsl/index.js";
import { WAVE8_ABILITIES } from "../../../wave8/index.js";
import { NICK_FURY_EVENTS } from "./events.js";
import { NICK_FURY_IDENTITY } from "./identity.js";

vi.setConfig({ testTimeout: 120_000 });

/**
 * Nick Fury's suit form (Assault / Stealth 50035a/b), Maria Hill (50036), Fury's Flying Car, Safe House #221, EM Shield,
 * Eyepatch Camera, Fury's Watch, Intelligence Analysis and Secret Agent (50040 to 50046), docs/phase7-wave9.md section
 * 8.4, 3.7, 3.8, 3.9. The printed precon `nick-fury-justice` against Rhino (stage 1: ATK 2, SCH 1). Rhino's boost card
 * is staged on top of the encounter deck, with harmless 0-icon attachments (Armored Rhino Suit) behind it.
 */
const DEPS = FURY_KIT_DEPS;
const ASSAULT = "50035a.assault-interrupt";
const STEALTH = "50035b.stealth-forced-interrupt";
const HILL = "50036.maria-hill-interrupt";
const CAR = "50040.furys-flying-car-action";
const SAFE_HOUSE = "50041.safe-house-221-action";
const SHIELD = "50042.em-shield-interrupt";
const EYEPATCH = "50043.eyepatch-camera-interrupt";
const WATCH = "50044.furys-watch-resource";
const ANALYSIS = "50045.intelligence-analysis-interrupt";
const AGENT = "50046.secret-agent-response";
const REFS = [ASSAULT, STEALTH, HILL, CAR, SAFE_HOUSE, SHIELD, EYEPATCH, WATCH, ANALYSIS, AGENT];
const CODES = ["50035a", "50036", "50040", "50041", "50042", "50043", "50044", "50045", "50046"];

const HAYMAKER = "01087"; // attack event, 2 resources, 3 damage
const MERCENARY = "01101"; // Hydra Mercenary: minion ATK 1, SCH 0, 1 boost icon
const SANDMAN = "01102"; // minion, 2 boost icons
const SHOCKER = "01103"; // minion, When Revealed: 1 damage to each hero
const FILLER = "01098"; // Armored Rhino Suit: an attachment with 0 boost icons and no stat change
const TOUGH = "01105"; // "I'm Tough!": When Revealed, give Rhino a tough status card
const ADVANCE = "01186"; // treachery, When Revealed: the villain schemes (0 boost icons)

const card = <T>(code: string): T => AOS_CARDS.find((c) => c.id === cardId(code)) as T;
const villainOf = (s: GameState): InstanceId => s.activeVillainId!;
const schemeOf = (s: GameState): InstanceId => s.mainScheme.instanceId;
const suitThreat = (s: GameState): number => inst(s, suitOf(s)!).threat;
const showsStealth = (s: GameState): boolean => inst(s, suitOf(s)!).flipped;
const mainThreat = (s: GameState): number => inst(s, schemeOf(s)).threat;
const myDamage = (s: GameState): number => inst(s, identityOf(s)).damage;
const withSuit = (s: GameState, patch: { threat?: number; flipped?: boolean }): GameState =>
  patchInstance(s, suitOf(s)!, patch);
const heroWithSuit = (patch: { threat?: number; flipped?: boolean } = {}): GameState => withSuit(furyHeroGame(), patch);
const ofType = <T extends GameEvent["type"]>(events: readonly GameEvent[], type: T) =>
  events.filter((e): e is Extract<GameEvent, { type: T }> => e.type === type);
const inPlayArea = (s: GameState, id: InstanceId): boolean => playerOf(s, P1).playArea.includes(id);
const attached = (s: GameState, id: InstanceId): boolean => inst(s, identityOf(s)).attachments.includes(id);
const inDiscard = (s: GameState, id: InstanceId): boolean => playerOf(s, P1).discard.includes(id);

/** How a test answers the engine's prompts. Triggers are declined unless named (an id suffix). */
interface Plan {
  readonly take?: readonly string[];
  readonly number?: number;
  readonly option?: string;
  readonly target?: InstanceId;
  readonly defender?: InstanceId;
  /** Declines this many offers of the named triggers before taking one. */
  readonly skip?: number;
  /** Collects every trigger id offered, and every number range asked. */
  readonly seen?: string[];
}
const planner = (plan: Plan = {}): Picker => {
  let skipped = 0;
  return (s) => {
    const choice = s.pendingChoice!;
    const offered = choice.options.map((o) => o.optionId as string);
    switch (choice.prompt.kind) {
      case "chooseTriggers": {
        plan.seen?.push(...offered);
        const hit = offered.find((o) => plan.take?.some((t) => o.endsWith(t)));
        if (hit && skipped < (plan.skip ?? 0)) {
          skipped++;
          return [];
        }
        return hit ? [hit] : [];
      }
      case "chooseNumber": {
        plan.seen?.push(`number:${choice.prompt.min}-${choice.prompt.max}`);
        return [String(plan.number ?? choice.prompt.max)];
      }
      case "declareDefender":
        return [plan.defender ?? "decline"];
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
};
/** The engine's refusal of `command`, or `undefined` when it is accepted. */
const refusal = (s: GameState, command: Command): string | undefined => {
  const result = applyCommand(s, command, DEPS);
  return result.ok ? undefined : result.error.message;
};
const run = (s: GameState, plan: Plan, ...commands: readonly Command[]) =>
  driveEventsPicking(DEPS, s, planner(plan), ...commands);

const basicAttack = (s: GameState): Command => ({
  type: "basicAttack",
  playerId: P1,
  attackerInstanceId: identityOf(s),
  targetInstanceId: villainOf(s),
});
const basicThwart = (s: GameState, thwarter: InstanceId = identityOf(s)): Command => ({
  type: "basicThwart",
  playerId: P1,
  thwarterInstanceId: thwarter,
  schemeInstanceId: schemeOf(s),
});

/**
 * The next villain phase with `codes` on top of the encounter deck (the first is Rhino's boost card, the next is dealt
 * to the player) and 0-icon attachments behind them. Ends P1's turn, and answers every prompt by `plan`.
 */
function stage(s: GameState, ...codes: readonly string[]): GameState {
  const pile = s.encounterDecks[activeEncounterDeckId(s)]!;
  return pile.deck
    .slice(0, codes.length + 8)
    .reduce((acc, id, index) => patchInstance(acc, id, { cardId: cardId(codes[index] ?? FILLER) }), s);
}
function villainPhase(s: GameState, plan: Plan, ...codes: readonly string[]) {
  return run(stage(s, ...codes), plan, endTurn(P1));
}
const damageToMe = (events: readonly GameEvent[], s: GameState): number =>
  ofType(events, "damageDealt")
    .filter((e) => e.targetInstanceId === identityOf(s))
    .reduce((sum, e) => sum + e.amount, 0);

describe("registry", () => {
  it("registers every printed ref of the nine cards; nothing is skipped", () => {
    const printed = CODES.flatMap((code) => abilityRefIds(card(code)));
    expect([...printed].sort()).toEqual([...REFS].sort());
    expect(Object.keys(REGISTRY).sort()).toEqual([...REFS].sort());
    expect(SKIPPED).toEqual({});
  });
  it.each(REFS)("%s validates", (id) => {
    expect(validateDefinition(REGISTRY[id]!)).toEqual([]);
  });
  it("timing words: Assault, Maria Hill, EM Shield, Eyepatch and Analysis are optional interrupts; Stealth a forced one", () => {
    for (const ref of [ASSAULT, HILL, SHIELD, EYEPATCH, ANALYSIS]) {
      expect(REGISTRY[ref]!.trigger, ref).toMatchObject({ kind: "interrupt", forced: false });
    }
    expect(REGISTRY[STEALTH]!.trigger).toMatchObject({ kind: "interrupt", forced: true, would: true });
    expect(REGISTRY[EYEPATCH]!.trigger).toMatchObject({ form: "hero" });
    expect(REGISTRY[AGENT]!.trigger).toMatchObject({ kind: "response", forced: false, form: "hero" });
    expect(REGISTRY[CAR]!.trigger).toMatchObject({ kind: "action", form: "hero" });
    expect(REGISTRY[SAFE_HOUSE]!.trigger).toMatchObject({ kind: "action", form: "alterEgo" });
  });
  it("costs: the printed arrows", () => {
    expect(REGISTRY[ASSAULT]!.cost).toEqual({
      removeThreat: { from: { kind: "self" }, amount: { choose: { min: 1, max: 3 } } },
    });
    expect(REGISTRY[CAR]!.cost).toMatchObject({ exhaustSelf: true, removeThreat: { amount: 1 } });
    expect(REGISTRY[SAFE_HOUSE]!.cost).toEqual({ exhaustSelf: true });
    expect(REGISTRY[SHIELD]!.cost).toEqual({ discardSelf: true });
    expect(REGISTRY[EYEPATCH]!.cost).toEqual({ discardSelf: true });
    expect(REGISTRY[ANALYSIS]!.cost).toMatchObject({ discardSelf: true, removeThreat: { amount: 1 } });
    expect(REGISTRY[AGENT]!.cost).toBeUndefined();
    expect(REGISTRY[HILL]!.cost).toBeUndefined();
  });
});

describe("printed data", () => {
  it("Assault / Stealth: cost -, Suit form and Permanent, ITEM and TECH, physical on the front, mental on the back", () => {
    const c = card<UpgradeCard & { flipSide: { name: string; resourceIcons: object } }>("50035a");
    expect(c.specialCost).toBe("dash");
    expect(c.keywords).toEqual([{ name: "form", formType: "suit" }, { name: "permanent" }]);
    expect(c.traits.map(String)).toEqual(["ITEM", "TECH"]);
    expect(c.resourceIcons).toEqual({ physical: 1 });
    expect(c.flipSide.name).toBe("Stealth");
    expect(c.flipSide.resourceIcons).toEqual({ mental: 1 });
  });
  it("Maria Hill: unique ally, cost 3, ATK 1, THW 2, 3 hit points, consequential damage 1 and 1, S.H.I.E.L.D.", () => {
    const c = card<AllyCard>("50036");
    expect([c.cost, c.atk, c.thw, c.hp, c.unique]).toEqual([3, 1, 2, 3, true]);
    expect(c.consequentialDamage).toEqual({ attack: 1, thwart: 1 });
    expect(c.traits.map(String)).toEqual(["S.H.I.E.L.D."]);
  });
  it("supports: Fury's Flying Car (unique, cost 2) and Safe House #221 (unique, cost 1)", () => {
    expect(card<SupportCard>("50040")).toMatchObject({ cost: 2, unique: true });
    expect(card<SupportCard>("50040").traits.map(String)).toEqual(["AERIAL", "TECH", "VEHICLE"]);
    expect(card<SupportCard>("50041")).toMatchObject({ cost: 1, unique: true });
  });
  it("upgrades: costs 2, 2, 1, 0, 2; the Preparation trait on EM Shield, Eyepatch Camera and Intelligence Analysis only", () => {
    const upgrades = ["50042", "50043", "50044", "50045", "50046"].map((code) => card<UpgradeCard>(code));
    expect(upgrades.map((c) => c.cost)).toEqual([2, 2, 1, 0, 2]);
    expect(upgrades.map((c) => c.traits.some((t) => String(t) === "PREPARATION"))).toEqual([
      true,
      true,
      false,
      true,
      false,
    ]);
    expect(upgrades.map((c) => c.unique)).toEqual([false, false, true, false, false]);
  });
});

describe(`${ASSAULT}: Interrupt: when you attack, remove up to 3 threat from here, +1 damage for each`, () => {
  const attackWith = (threat: number, plan: Plan = {}) => {
    const s = heroWithSuit({ threat });
    return run(s, { take: ["assault-interrupt"], ...plan }, basicAttack(s));
  };
  it("with 0 threat on it, it is not offered: the attack deals 2", () => {
    const seen: string[] = [];
    const { state } = attackWith(0, { seen });
    expect(seen).toEqual([]);
    expect(inst(state, villainOf(state)).damage).toBe(2);
    expect(suitThreat(state)).toBe(0);
  });
  it("with 1 threat it removes the 1 (a range of one is not asked): 2 + 1 = 3 damage, 0 left", () => {
    const seen: string[] = [];
    const { state } = attackWith(1, { seen });
    expect(seen.filter((o) => o.startsWith("number"))).toEqual([]);
    expect(inst(state, villainOf(state)).damage).toBe(3);
    expect(suitThreat(state)).toBe(0);
  });
  it("with 3 threat the amount is asked from 1 to 3; removing all 3: 2 + 3 = 5 damage, 0 left", () => {
    const seen: string[] = [];
    const { state } = attackWith(3, { seen, number: 3 });
    expect(seen.filter((o) => o.startsWith("number"))).toEqual(["number:1-3"]);
    expect(inst(state, villainOf(state)).damage).toBe(5);
    expect(suitThreat(state)).toBe(0);
  });
  it("with 4 threat at most 3 can be removed: 2 + 3 = 5 damage and 1 threat is left", () => {
    const seen: string[] = [];
    const { state } = attackWith(4, { seen, number: 3 });
    expect(seen.filter((o) => o.startsWith("number"))).toEqual(["number:1-3"]);
    expect(inst(state, villainOf(state)).damage).toBe(5);
    expect(suitThreat(state)).toBe(1);
  });
  it("with 4 threat, removing 2: 2 + 2 = 4 damage and 2 threat are left", () => {
    const { state } = attackWith(4, { number: 2 });
    expect(inst(state, villainOf(state)).damage).toBe(4);
    expect(suitThreat(state)).toBe(2);
  });
  it("it is optional: declined, the attack deals 2 and the threat stays", () => {
    const s = heroWithSuit({ threat: 4 });
    const { state } = run(s, {}, basicAttack(s));
    expect(inst(state, villainOf(state)).damage).toBe(2);
    expect(suitThreat(state)).toBe(4);
  });
  it("the extra damage is for this attack only: a second basic attack deals 2", () => {
    const s = heroWithSuit({ threat: 4 });
    const first = run(s, { take: ["assault-interrupt"], number: 3 }, basicAttack(s));
    const ready = patchInstance(first.state, identityOf(first.state), { exhausted: false });
    const second = run(ready, {}, basicAttack(ready));
    expect(inst(second.state, villainOf(second.state)).damage).toBe(7);
  });
  // docs/phase7-wave9.md section 3.8: Break Cover (a forced interrupt) turns Assault faceup before the optional
  // interrupts to the same attack are offered, so Assault's own interrupt answers the attack that broke cover
  // (`Frame<"window">.facesAtOpen`; RRG 1.8 "Interrupt", p. 25: the attack has not resolved yet).
  it("in Stealth with 4 threat, a basic attack breaks cover and Assault is offered: remove 3, 2 + 3 = 5 damage, 1 left", () => {
    const s = heroWithSuit({ threat: 4, flipped: true });
    const seen: string[] = [];
    const { state, events } = run(s, { take: ["assault-interrupt"], number: 3, seen }, basicAttack(s));
    expect(seen.filter((o) => o.endsWith("assault-interrupt"))).toHaveLength(1);
    expect(seen.filter((o) => o.startsWith("number"))).toEqual(["number:1-3"]);
    expect(showsStealth(state)).toBe(false);
    expect(ofType(events, "additionalFormChanged")).toMatchObject([{ formType: "suit", formName: "Assault" }]);
    expect(inst(state, villainOf(state)).damage).toBe(5);
    expect(suitThreat(state)).toBe(1);
  });
  it("breaking cover and declining Assault: Assault faceup, 2 damage, the 4 threat stays", () => {
    const s = heroWithSuit({ threat: 4, flipped: true });
    const seen: string[] = [];
    const { state } = run(s, { seen }, basicAttack(s));
    expect(seen.filter((o) => o.endsWith("assault-interrupt"))).toHaveLength(1);
    expect(showsStealth(state)).toBe(false);
    expect(inst(state, villainOf(state)).damage).toBe(2);
    expect(suitThreat(state)).toBe(4);
  });
  it("the next attack, with Assault already faceup, spends what is left: 2 + 1 = 3 and 0 left", () => {
    const s = heroWithSuit({ threat: 4, flipped: true });
    const first = run(s, { take: ["assault-interrupt"], number: 3 }, basicAttack(s));
    const ready = patchInstance(first.state, identityOf(first.state), { exhausted: false });
    const { state, events } = run(ready, { take: ["assault-interrupt"] }, basicAttack(ready));
    expect(ofType(events, "additionalFormChanged")).toEqual([]);
    expect(inst(state, villainOf(state)).damage).toBe(5 + 3);
    expect(suitThreat(state)).toBe(0);
  });
  it("in Stealth with 0 threat, Break Cover still turns Assault faceup and nothing is offered", () => {
    const s = heroWithSuit({ threat: 0, flipped: true });
    const seen: string[] = [];
    const { state } = run(s, { take: ["assault-interrupt"], seen }, basicAttack(s));
    expect(seen).toEqual([]);
    expect(showsStealth(state)).toBe(false);
    expect(inst(state, villainOf(state)).damage).toBe(2);
  });
  it("an attack event breaks cover too: Haymaker (3) from Stealth with 4 threat, remove 3: 3 + 3 = 6 damage, 1 left", () => {
    const base = withSuit(furyHeroGame({ swap: { "50049": HAYMAKER } }), { threat: 4, flipped: true });
    const given = moveToHand(base, P1, HAYMAKER);
    const haymaker = given.ids[0]!;
    const seen: string[] = [];
    const { state } = run(
      given.state,
      { take: ["assault-interrupt"], number: 3, seen },
      play(P1, haymaker, payWith(given.state, P1, 2, [haymaker])),
    );
    expect(seen.filter((o) => o.endsWith("assault-interrupt"))).toHaveLength(1);
    expect(showsStealth(state)).toBe(false);
    expect(inst(state, villainOf(state)).damage).toBe(6);
    expect(suitThreat(state)).toBe(1);
  });
  it("the attack event from Stealth, Assault declined: Haymaker deals 3 and the 4 threat stays", () => {
    const base = withSuit(furyHeroGame({ swap: { "50049": HAYMAKER } }), { threat: 4, flipped: true });
    const given = moveToHand(base, P1, HAYMAKER);
    const haymaker = given.ids[0]!;
    const seen: string[] = [];
    const { state } = run(given.state, { seen }, play(P1, haymaker, payWith(given.state, P1, 2, [haymaker])));
    expect(seen.filter((o) => o.endsWith("assault-interrupt"))).toHaveLength(1);
    expect(showsStealth(state)).toBe(false);
    expect(inst(state, villainOf(state)).damage).toBe(3);
    expect(suitThreat(state)).toBe(4);
  });
  it("an attack event from Assault is an attack too: Haymaker (3) with 2 threat deals 3 + 2 = 5", () => {
    const base = withSuit(furyHeroGame({ swap: { "50049": HAYMAKER } }), { threat: 2 });
    const given = moveToHand(base, P1, HAYMAKER);
    const haymaker = given.ids[0]!;
    const { state } = run(
      given.state,
      { take: ["assault-interrupt"] },
      play(P1, haymaker, payWith(given.state, P1, 2, [haymaker])),
    );
    expect(inst(state, villainOf(state)).damage).toBe(5);
    expect(suitThreat(state)).toBe(0);
  });
  it("an ally's attack is not 'you': it is not offered", () => {
    const hill = stagedInPlay(heroWithSuit({ threat: 4 }), "50036");
    const seen: string[] = [];
    const { state } = run(
      hill.state,
      { take: ["assault-interrupt"], seen },
      {
        type: "basicAttack",
        playerId: P1,
        attackerInstanceId: hill.id,
        targetInstanceId: villainOf(hill.state),
      },
    );
    expect(seen.filter((o) => o.endsWith("assault-interrupt"))).toEqual([]);
    expect(inst(state, villainOf(state)).damage).toBe(1);
    expect(suitThreat(state)).toBe(4);
  });
});

describe(`${STEALTH}: Forced Interrupt (Hero): when an enemy would attack you, it schemes instead; 1 threat here`, () => {
  const stealth = (threat: number) => heroWithSuit({ threat, flipped: true });
  it("Rhino (SCH 1) with a 1-icon boost, Stealth at 5: no attack; main +1 (phase) +1, Stealth takes 1 and shows 6", () => {
    const s = stealth(5);
    const { state, events } = villainPhase(s, {}, MERCENARY);
    expect(damageToMe(events, s)).toBe(0);
    expect(myDamage(state)).toBe(0);
    expect(ofType(events, "schemeResolved")).toMatchObject([
      { baseSch: 1, boostIcons: 1, threatPlaced: 1, diverted: { amount: 1 } },
    ]);
    expect(mainThreat(state)).toBe(mainThreat(s) + 2);
    expect(suitThreat(state)).toBe(6);
    expect(showsStealth(state)).toBe(true);
  });
  it("it is forced: no prompt, and a 0-icon boost still diverts 1 (SCH 1)", () => {
    const s = stealth(2);
    const seen: string[] = [];
    const { state, events } = villainPhase(s, { seen }, FILLER);
    expect(seen.filter((o) => o.endsWith("stealth-forced-interrupt"))).toEqual([]);
    expect(ofType(events, "schemeResolved")).toMatchObject([
      { baseSch: 1, boostIcons: 0, threatPlaced: 0, diverted: { amount: 1 } },
    ]);
    expect(mainThreat(state)).toBe(mainThreat(s) + 1); // only the villain phase's own threat
    expect(suitThreat(state)).toBe(3);
  });
  it("with 6 threat on it, nothing is diverted: all of SCH 1 + 1 icon goes on the main scheme (+1 phase threat)", () => {
    const s = stealth(6);
    const { state, events } = villainPhase(s, {}, MERCENARY);
    expect(damageToMe(events, s)).toBe(0);
    expect(ofType(events, "schemeResolved")).toMatchObject([{ threatPlaced: 2 }]);
    expect(mainThreat(state)).toBe(mainThreat(s) + 3);
    expect(suitThreat(state)).toBe(6);
  });
  it("the same activation in Assault: Rhino attacks (boost 1 + ATK 2 = 3 damage) and the suit is untouched", () => {
    const s = withSuit(furyHeroGame(), { threat: 5 });
    const { state, events } = villainPhase(s, {}, MERCENARY);
    expect(damageToMe(events, s)).toBe(3);
    expect(mainThreat(state)).toBe(mainThreat(s) + 1);
    expect(suitThreat(state)).toBe(5);
  });
  it("the scheme is a real activation: a confused Rhino loses the status card and does nothing (no threat, no attack)", () => {
    const s = patchInstance(stealth(3), villainOf(stealth(3)), { statuses: { stunned: 0, confused: 1, tough: 0 } });
    const { state, events } = villainPhase(s, {}, MERCENARY);
    expect(damageToMe(events, s)).toBe(0);
    expect(inst(state, villainOf(state)).statuses.confused).toBe(0);
    expect(suitThreat(state)).toBe(3);
    expect(mainThreat(state)).toBe(mainThreat(s) + 1);
  });
  it("a stunned Rhino loses the status card instead of activating: no scheme, Stealth unchanged", () => {
    const s = patchInstance(stealth(3), villainOf(stealth(3)), { statuses: { stunned: 1, confused: 0, tough: 0 } });
    const { state, events } = villainPhase(s, {}, MERCENARY);
    expect(damageToMe(events, s)).toBe(0);
    expect(ofType(events, "schemeResolved")).toEqual([]);
    expect(inst(state, villainOf(state)).statuses.stunned).toBe(0);
    expect(suitThreat(state)).toBe(3);
  });
  it("a minion with SCH 0 (Hydra Mercenary) would attack: it schemes for 0 and nothing is placed or diverted", () => {
    const s = engageMinion(stealth(2), MERCENARY, "merc");
    const { state, events } = villainPhase(s, {}, FILLER, FILLER);
    const schemes = ofType(events, "schemeResolved");
    expect(schemes).toHaveLength(2);
    expect(schemes[1]).toMatchObject({ baseSch: 0, threatPlaced: 0 });
    expect(schemes[1]!.diverted ?? null).toBeNull();
    expect(damageToMe(events, s)).toBe(0);
    expect(suitThreat(state)).toBe(3); // only Rhino's 1
  });
  it("Leviathan Soldier (SCH 0) would attack: it schemes and its 'after it schemes, deal 1 damage' answers", () => {
    const withSoldier = engageMinion(stealth(2), "50062", "soldier");
    const deps = {
      abilities: mergeRegistries(
        WAVE8_ABILITIES,
        NICK_FURY_IDENTITY,
        NICK_FURY_EVENTS,
        REGISTRY,
        NICK_FURY_OBLIGATION_NEMESIS,
      ),
    };
    const { state, events } = driveEventsPicking(deps, stage(withSoldier, FILLER, FILLER), planner(), endTurn(P1));
    expect(damageToMe(events, withSoldier)).toBe(1);
    expect(myDamage(state)).toBe(1);
    expect(suitThreat(state)).toBe(3);
  });
  it("in alter-ego form it is a hero ability: Rhino schemes as usual and the threat all goes on the main scheme", () => {
    const s = withSuit(furyGame(), { threat: 5, flipped: true });
    const { state, events } = villainPhase(s, {}, MERCENARY);
    expect(ofType(events, "schemeResolved")).toMatchObject([{ threatPlaced: 2 }]);
    expect(suitThreat(state)).toBe(5);
    expect(mainThreat(state)).toBe(mainThreat(s) + 3);
  });
});

describe(`${HILL}: Interrupt: when Maria Hill thwarts, place the removed threat on your suit form upgrade`, () => {
  const withHill = (scheme: number, suit: { threat?: number; flipped?: boolean } = {}) => {
    const staged = stagedInPlay(withSuit(furyHeroGame(), suit), "50036");
    return { hill: staged.id, state: patchInstance(staged.state, schemeOf(staged.state), { threat: scheme }) };
  };
  it("her THW 2 on a scheme with 5: the scheme has 3 and the suit gains 2", () => {
    const { hill, state: s } = withHill(5);
    const { state } = run(s, { take: ["maria-hill-interrupt"] }, basicThwart(s, hill));
    expect(mainThreat(state)).toBe(3);
    expect(suitThreat(state)).toBe(2);
  });
  it("it adds to the threat already on the suit, and onto Stealth just the same", () => {
    const { hill, state: s } = withHill(5, { threat: 3, flipped: true });
    const { state } = run(s, { take: ["maria-hill-interrupt"] }, basicThwart(s, hill));
    expect(mainThreat(state)).toBe(3);
    expect(suitThreat(state)).toBe(5);
    expect(showsStealth(state)).toBe(true);
  });
  it("only what is removed: a scheme with 1 threat loses 1 and the suit gains 1", () => {
    const { hill, state: s } = withHill(1);
    const { state } = run(s, { take: ["maria-hill-interrupt"] }, basicThwart(s, hill));
    expect(mainThreat(state)).toBe(0);
    expect(suitThreat(state)).toBe(1);
  });
  it("it is optional: declined, the scheme has 3 and the suit 0", () => {
    const { hill, state: s } = withHill(5);
    const { state } = run(s, {}, basicThwart(s, hill));
    expect(mainThreat(state)).toBe(3);
    expect(suitThreat(state)).toBe(0);
  });
  it("her thwart costs her 1 consequential damage (printed 1 on a thwart)", () => {
    const { hill, state: s } = withHill(5);
    const { state } = run(s, { take: ["maria-hill-interrupt"] }, basicThwart(s, hill));
    expect(inst(state, hill).damage).toBe(1);
  });
  it("it is hers alone: Nick Fury's own thwart does not offer it (Gather Intel aside, the suit stays at 0)", () => {
    const { state: s } = withHill(5);
    const seen: string[] = [];
    const { state } = run(s, { take: ["maria-hill-interrupt"], seen }, basicThwart(s));
    expect(seen.filter((o) => o.endsWith("maria-hill-interrupt"))).toEqual([]);
    expect(mainThreat(state)).toBe(3);
    expect(suitThreat(state)).toBe(0);
  });
  it("played from hand she costs 3 and enters play ready with her stats", () => {
    const s = furyHeroGame();
    const given = moveToHand(s, P1, "50036");
    const hill = given.ids[0]!;
    const handBefore = playerOf(given.state, P1).hand.length;
    const { state } = run(given.state, {}, play(P1, hill, payWith(given.state, P1, 3, [hill])));
    expect(inPlayArea(state, hill)).toBe(true);
    expect(inst(state, hill).exhausted).toBe(false);
    expect(playerOf(state, P1).hand).toHaveLength(handBefore - 4);
  });
});

describe(`${CAR}: Hero Action: exhaust the Car and remove 1 threat from your suit form upgrade, ready Nick Fury, Aerial`, () => {
  const exhaustedFury = (suit: number) => {
    const staged = stagedInPlay(heroWithSuit({ threat: suit }), "50040");
    return { car: staged.id, state: patchInstance(staged.state, identityOf(staged.state), { exhausted: true }) };
  };
  const aerial = (s: GameState): boolean => traitsOf(s, identityOf(s), DEPS).some((t) => String(t) === "AERIAL");
  it("with 2 threat: the suit has 1, the Car is exhausted, Nick Fury is ready and Aerial", () => {
    const { car, state: s } = exhaustedFury(2);
    expect(aerial(s)).toBe(false);
    const { state } = run(s, {}, use(P1, car, CAR));
    expect(suitThreat(state)).toBe(1);
    expect(inst(state, car).exhausted).toBe(true);
    expect(inst(state, identityOf(state)).exhausted).toBe(false);
    expect(aerial(state)).toBe(true);
  });
  it("the trait lasts until the end of the round: it is gone once the villain phase has ended", () => {
    const { car, state: s } = exhaustedFury(2);
    const used = run(s, {}, use(P1, car, CAR)).state;
    expect(aerial(used)).toBe(true);
    const next = villainPhase(used, {}, FILLER).state;
    expect(next.step.phase).toBe("player");
    expect(aerial(next)).toBe(false);
  });
  it("with 1 threat the cost is paid in full: the suit is at 0", () => {
    const { car, state: s } = exhaustedFury(1);
    expect(suitThreat(run(s, {}, use(P1, car, CAR)).state)).toBe(0);
  });
  it("with 0 threat on the suit it cannot be used (nothing is exhausted)", () => {
    const { car, state: s } = exhaustedFury(0);
    expect(refusal(s, use(P1, car, CAR))).toMatch(/not enough threat there to remove 1/);
  });
  it("an exhausted Car cannot be used", () => {
    const { car, state: s } = exhaustedFury(2);
    const tired = patchInstance(s, car, { exhausted: true });
    expect(refusal(tired, use(P1, car, CAR))).toMatch(/already exhausted/);
  });
  it("in alter-ego form it cannot be used (a Hero Action)", () => {
    const staged = stagedInPlay(withSuit(furyGame(), { threat: 2 }), "50040");
    expect(refusal(staged.state, use(P1, staged.id, CAR))).toMatch(/requires hero form/);
  });
  it("it readies a Nick Fury who is already ready without error, still paying the cost", () => {
    const staged = stagedInPlay(heroWithSuit({ threat: 2 }), "50040");
    const { state } = run(staged.state, {}, use(P1, staged.id, CAR));
    expect(suitThreat(state)).toBe(1);
    expect(inst(state, identityOf(state)).exhausted).toBe(false);
  });
});

describe(`${SAFE_HOUSE}: Alter-Ego Action: exhaust Safe House #221, heal 2 from Nick Fury or place 1 threat on the suit`, () => {
  const house = (damage: number, threat = 0) => {
    const staged = stagedInPlay(withSuit(furyGame(), { threat }), "50041");
    return { id: staged.id, state: patchInstance(staged.state, identityOf(staged.state), { damage }) };
  };
  it("choose heal: 4 damage becomes 2, the suit is untouched, the support is exhausted", () => {
    const { id, state: s } = house(4);
    const { state } = run(s, { option: "Heal" }, use(P1, id, SAFE_HOUSE));
    expect(myDamage(state)).toBe(2);
    expect(suitThreat(state)).toBe(0);
    expect(inst(state, id).exhausted).toBe(true);
  });
  it("heal never goes below 0: 1 damage becomes 0", () => {
    const { id, state: s } = house(1);
    expect(myDamage(run(s, { option: "Heal" }, use(P1, id, SAFE_HOUSE)).state)).toBe(0);
  });
  it("choose threat: 1 threat is placed on the suit (2 becomes 3) and no damage is healed", () => {
    const { id, state: s } = house(4, 2);
    const { state } = run(s, { option: "Place" }, use(P1, id, SAFE_HOUSE));
    expect(suitThreat(state)).toBe(3);
    expect(myDamage(state)).toBe(4);
  });
  it("it offers exactly the two printed choices", () => {
    const { id, state: s } = house(4);
    const labels: string[] = [];
    driveEventsPicking(
      DEPS,
      s,
      (st) => {
        labels.push(...st.pendingChoice!.options.map((o) => o.label));
        return firstLegal(st);
      },
      use(P1, id, SAFE_HOUSE),
    );
    expect(labels).toEqual(["Heal 2 damage from Nick Fury", "Place 1 threat on your suit form upgrade"]);
  });
  it("it cannot be used in hero form, or while exhausted", () => {
    const heroHouse = stagedInPlay(heroWithSuit(), "50041");
    expect(refusal(heroHouse.state, use(P1, heroHouse.id, SAFE_HOUSE))).toMatch(/requires alterEgo form/);
    const { id, state: s } = house(4);
    expect(refusal(patchInstance(s, id, { exhausted: true }), use(P1, id, SAFE_HOUSE))).toMatch(/already exhausted/);
  });
  it("played from hand it costs 1", () => {
    const given = moveToHand(furyGame(), P1, "50041");
    const id = given.ids[0]!;
    const handBefore = playerOf(given.state, P1).hand.length;
    const { state } = run(given.state, {}, play(P1, id, payWith(given.state, P1, 1, [id])));
    expect(inPlayArea(state, id)).toBe(true);
    expect(playerOf(state, P1).hand).toHaveLength(handBefore - 2);
  });
});

describe(`${SHIELD}: Interrupt (defense): when you would take damage from an attack, discard EM Shield, prevent all of it`, () => {
  const shielded = () => stagedInPlay(heroWithSuit(), "50042", { attach: true });
  it("Rhino (ATK 2 + a 1-icon boost) would deal 3: all of it is prevented and the shield is discarded", () => {
    const { id, state: s } = shielded();
    const { state, events } = villainPhase(s, { take: ["em-shield-interrupt"] }, MERCENARY);
    expect(myDamage(state)).toBe(0);
    expect(damageToMe(events, s)).toBe(0);
    expect(attached(state, id)).toBe(false);
    expect(inDiscard(state, id)).toBe(true);
  });
  it("it is optional: declined, Nick takes 3 and the shield stays attached", () => {
    const { id, state: s } = shielded();
    const { state } = villainPhase(s, {}, MERCENARY);
    expect(myDamage(state)).toBe(3);
    expect(attached(state, id)).toBe(true);
  });
  it("damage that is not from an attack is not offered: Shocker's 1 damage lands, the shield is offered only for the attack", () => {
    const { id, state: s } = shielded();
    const seen: string[] = [];
    const { state } = villainPhase(s, { seen }, MERCENARY, SHOCKER);
    expect(seen.filter((o) => o.endsWith("em-shield-interrupt"))).toHaveLength(1);
    expect(myDamage(state)).toBe(3 + 1);
    expect(attached(state, id)).toBe(true);
  });
  it("its trigger is damage to your identity from an attack (not an ally, not non-attack damage)", () => {
    expect(REGISTRY[SHIELD]!.trigger).toMatchObject({ on: { on: "dealDamage", fromAttack: true } });
  });
  it("it is a Preparation upgrade that costs 2 and attaches to Nick Fury", () => {
    const given = moveToHand(heroWithSuit(), P1, "50042");
    const id = given.ids[0]!;
    const { state } = run(
      given.state,
      {},
      play(P1, id, payWith(given.state, P1, 2, [id]), { attachToInstanceId: identityOf(given.state) }),
    );
    expect(attached(state, id)).toBe(true);
  });
});

describe(`${EYEPATCH}: Hero Interrupt: when threat would be placed on the main scheme, discard it, place up to 3 on the suit instead`, () => {
  const camera = (state: GameState = heroWithSuit()) => stagedInPlay(state, "50043", { attach: true });
  it("the villain phase's 1 threat: choosing 1 puts it on the suit, the main scheme gains nothing, the camera is discarded", () => {
    const { id, state: s } = camera();
    const seen: string[] = [];
    const { state } = villainPhase(s, { take: ["eyepatch-camera-interrupt"], number: 1, seen }, MERCENARY);
    expect(seen).toContain("number:0-1");
    expect(mainThreat(state)).toBe(mainThreat(s));
    expect(suitThreat(state)).toBe(1);
    expect(inDiscard(state, id)).toBe(true);
  });
  it("choosing 0 discards the camera and leaves all the threat on the main scheme", () => {
    const { id, state: s } = camera();
    const { state } = villainPhase(s, { take: ["eyepatch-camera-interrupt"], number: 0 }, MERCENARY);
    expect(mainThreat(state)).toBe(mainThreat(s) + 1);
    expect(suitThreat(state)).toBe(0);
    expect(inDiscard(state, id)).toBe(true);
  });
  it("a 3-threat scheme activation (SCH 1 + a 2-icon boost): choosing 3 moves it all, choosing 2 leaves 1 on the scheme", () => {
    const { state: s } = camera();
    const all = villainPhase(
      s,
      { take: ["eyepatch-camera-interrupt"], skip: 1, number: 3 },
      MERCENARY,
      ADVANCE,
      SANDMAN,
    );
    expect(mainThreat(all.state)).toBe(mainThreat(s) + 1); // the phase's own threat only
    expect(suitThreat(all.state)).toBe(3);
    const some = villainPhase(
      s,
      { take: ["eyepatch-camera-interrupt"], skip: 1, number: 2 },
      MERCENARY,
      ADVANCE,
      SANDMAN,
    );
    expect(mainThreat(some.state)).toBe(mainThreat(s) + 1 + 1);
    expect(suitThreat(some.state)).toBe(2);
  });
  it("the amount offered is capped at 3: the prompt for a 3-threat activation is 0 to 3", () => {
    const { state: s } = camera();
    const seen: string[] = [];
    villainPhase(s, { take: ["eyepatch-camera-interrupt"], skip: 1, number: 3, seen }, MERCENARY, ADVANCE, SANDMAN);
    expect(seen).toContain("number:0-3");
  });
  it("it is a Hero Interrupt: in alter-ego form it is not offered", () => {
    const staged = camera(withSuit(furyGame(), { threat: 0 }));
    const seen: string[] = [];
    const { state } = villainPhase(staged.state, { take: ["eyepatch-camera-interrupt"], seen }, MERCENARY);
    expect(seen.filter((o) => o.endsWith("eyepatch-camera-interrupt"))).toEqual([]);
    expect(suitThreat(state)).toBe(0);
    expect(attached(state, staged.id)).toBe(true);
  });
  it("it is optional: declined, the camera stays attached and the scheme gains the threat", () => {
    const { id, state: s } = camera();
    const { state } = villainPhase(s, {}, MERCENARY);
    expect(mainThreat(state)).toBe(mainThreat(s) + 1);
    expect(attached(state, id)).toBe(true);
  });
});

describe(`${WATCH}: Resource: exhaust Fury's Watch and remove up to 2 threat from the suit, a mental resource for each`, () => {
  const MENTAL = (n: number) => ({ energy: 0, mental: n, physical: 0, wild: 0 });
  /** Fury's Watch attached, the suit holding `suit` threat, and `code` in hand (Haymaker swapped into the deck). */
  const withWatch = (suit: number, code = HAYMAKER, base?: GameState) => {
    const game = base ?? furyHeroGame({ swap: { "50049": HAYMAKER } });
    const watch = stagedInPlay(withSuit(game, { threat: suit }), "50044", { attach: true });
    const given = moveToHand(watch.state, P1, code);
    return { state: given.state, watch: watch.id, card: given.ids[0]! };
  };
  const watchUse = (watch: InstanceId, removeThreat?: number): Payment => ({
    ability: {
      instanceId: watch,
      abilityId: WATCH as never,
      ...(removeThreat === undefined ? {} : { costSelection: { removeThreat } }),
    },
  });
  const generatedByWatch = (events: readonly GameEvent[], watch: InstanceId) =>
    ofType(events, "resourcesGenerated")
      .filter((e) => e.instanceId === watch)
      .map((e) => e.pool);
  const watchSources = (s: GameState, cardInHand: InstanceId) =>
    (paymentFor(s, P1, { kind: "playCard", instanceId: cardInHand }, {}, DEPS)?.sources ?? []).filter(
      (source) => source.kind === "resourceAbility",
    );

  it("is a Resource ability with no form word: exhaust it and remove up to 2 threat from the suit", () => {
    expect(REGISTRY[WATCH]!.trigger).toEqual({ kind: "resource" });
    expect(REGISTRY[WATCH]!.cost).toMatchObject({
      exhaustSelf: true,
      removeThreat: { amount: { choose: { min: 1, max: 2 } } },
    });
    expect(REGISTRY[WATCH]!.generates).toMatchObject({ kind: "amount", resource: "mental" });
  });
  it("with 0 threat on the suit it is not a payment source and a payment naming it is refused", () => {
    const { state: s, watch, card: haymaker } = withWatch(0);
    expect(watchSources(s, haymaker)).toEqual([]);
    expect(refusal(s, play(P1, haymaker, [], { abilities: [watchUse(watch)] }))).toMatch(/not enough threat/);
  });
  it("with 1 threat it is worth 1 [mental]: with one hand card it pays Haymaker (2); the suit is left with 0", () => {
    const { state: s, watch, card: haymaker } = withWatch(1);
    expect(watchSources(s, haymaker).map((source) => source.pool)).toEqual([MENTAL(1)]);
    expect(refusal(s, play(P1, haymaker, [], { abilities: [watchUse(watch)] }))).toBeDefined();
    const seen: string[] = [];
    const { state, events } = run(
      s,
      { seen },
      play(P1, haymaker, payWith(s, P1, 1, [haymaker]), { abilities: [watchUse(watch)] }),
    );
    expect(seen.filter((o) => o.startsWith("number"))).toEqual([]);
    expect(generatedByWatch(events, watch)).toEqual([MENTAL(1)]);
    expect(suitThreat(state)).toBe(0);
    expect(inst(state, watch).exhausted).toBe(true);
    expect(inst(state, villainOf(state)).damage).toBe(3);
  });
  it("with 4 threat it offers 2 [mental] and 1 [mental] as two sources of the one ability", () => {
    const { state: s, card: haymaker } = withWatch(4);
    expect(watchSources(s, haymaker).map((source) => [source.costSelection?.removeThreat, source.pool])).toEqual([
      [undefined, MENTAL(2)],
      [1, MENTAL(1)],
    ]);
  });
  it("with 4 threat, removing 2 pays Haymaker (2) alone: the suit is left with 2, and no hand card is spent", () => {
    const { state: s, watch, card: haymaker } = withWatch(4);
    const hand = playerOf(s, P1).hand.length;
    const { state, events } = run(s, {}, play(P1, haymaker, [], { abilities: [watchUse(watch, 2)] }));
    expect(generatedByWatch(events, watch)).toEqual([MENTAL(2)]);
    expect(suitThreat(state)).toBe(2);
    expect(playerOf(state, P1).hand.length).toBe(hand - 1);
    expect(inst(state, villainOf(state)).damage).toBe(3);
  });
  it("unnamed, it removes the most: 2 of 4", () => {
    const { state: s, watch, card: haymaker } = withWatch(4);
    const { state, events } = run(s, {}, play(P1, haymaker, [], { abilities: [watchUse(watch)] }));
    expect(generatedByWatch(events, watch)).toEqual([MENTAL(2)]);
    expect(suitThreat(state)).toBe(2);
  });
  it("with 4 threat, removing 1 is 1 [mental]: it needs one hand card for Haymaker, and the suit is left with 3", () => {
    const { state: s, watch, card: haymaker } = withWatch(4);
    expect(refusal(s, play(P1, haymaker, [], { abilities: [watchUse(watch, 1)] }))).toBeDefined();
    const { state, events } = run(
      s,
      {},
      play(P1, haymaker, payWith(s, P1, 1, [haymaker]), { abilities: [watchUse(watch, 1)] }),
    );
    expect(generatedByWatch(events, watch)).toEqual([MENTAL(1)]);
    expect(suitThreat(state)).toBe(3);
  });
  it("at most 2: naming 3 of 4 is refused, as is 0", () => {
    const { state: s, watch, card: haymaker } = withWatch(4);
    expect(refusal(s, play(P1, haymaker, [], { abilities: [watchUse(watch, 3)] }))).toMatch(/removes 1 to 2 threat/);
    expect(refusal(s, play(P1, haymaker, [], { abilities: [watchUse(watch, 0)] }))).toMatch(/removes 1 to 2 threat/);
  });
  it("the threat it spends is gone before Assault's interrupt: Haymaker paid with 2 of 4, then Assault removes 2 for 3 + 2 = 5", () => {
    const { state: s, watch, card: haymaker } = withWatch(4);
    const seen: string[] = [];
    const { state } = run(
      s,
      { take: ["assault-interrupt"], seen },
      play(P1, haymaker, [], { abilities: [watchUse(watch, 2)] }),
    );
    expect(seen.filter((o) => o.startsWith("number"))).toEqual(["number:1-2"]);
    expect(inst(state, villainOf(state)).damage).toBe(5);
    expect(suitThreat(state)).toBe(0);
  });
  it("it is not a Hero Resource: in alter-ego form it pays for Eyepatch Camera (2)", () => {
    const { state: s, watch, card: camera } = withWatch(2, "50043", furyGame());
    const { state, events } = run(s, {}, play(P1, camera, [], { abilities: [watchUse(watch)] }));
    expect(generatedByWatch(events, watch)).toEqual([MENTAL(2)]);
    expect(suitThreat(state)).toBe(0);
    expect(attached(state, camera)).toBe(true);
  });
  it("exhausted, it is not a source", () => {
    const { state: ready, watch, card: haymaker } = withWatch(4);
    const s = patchInstance(ready, watch, { exhausted: true });
    expect(watchSources(s, haymaker)).toEqual([]);
    expect(refusal(s, play(P1, haymaker, [], { abilities: [watchUse(watch, 2)] }))).toBeDefined();
  });
  it("the card's data is right: unique ITEM and TECH upgrade, cost 1, one physical icon", () => {
    const c = card<UpgradeCard>("50044");
    expect([c.cost, c.unique, c.resourceIcons]).toEqual([1, true, { physical: 1 }]);
    expect(c.traits.map(String)).toEqual(["ITEM", "TECH"]);
  });
});

describe(`${ANALYSIS}: Interrupt: when you reveal a treachery, discard it and remove 1 threat from the suit, cancel the treachery`, () => {
  const analysis = (suit: number, base: GameState = heroWithSuit({ threat: suit })) =>
    stagedInPlay(base, "50045", { attach: true });
  const toughOf = (s: GameState): number => inst(s, villainOf(s)).statuses.tough;
  it("'I'm Tough!' revealed: cancelled, so Rhino gets no tough card; the suit loses 1 and the upgrade is discarded", () => {
    const { id, state: s } = analysis(2);
    const { state } = villainPhase(s, { take: ["intelligence-analysis-interrupt"] }, FILLER, TOUGH);
    expect(toughOf(state)).toBe(0);
    expect(suitThreat(state)).toBe(1);
    expect(inDiscard(state, id)).toBe(true);
    const cancelled = Object.values(state.encounterDecks).some((d) =>
      d.discard.some((card) => (state.instances[card]!.cardId as string) === TOUGH),
    );
    expect(cancelled).toBe(true);
  });
  it("without it the treachery resolves: Rhino gets a tough status card", () => {
    const { state: s } = analysis(2);
    const { state } = villainPhase(s, {}, FILLER, TOUGH);
    expect(toughOf(state)).toBe(1);
    expect(suitThreat(state)).toBe(2);
  });
  it("it needs 1 threat on the suit: with 0 it is not offered", () => {
    const { id, state: s } = analysis(0);
    const seen: string[] = [];
    const { state } = villainPhase(s, { take: ["intelligence-analysis-interrupt"], seen }, FILLER, TOUGH);
    expect(seen.filter((o) => o.endsWith("intelligence-analysis-interrupt"))).toEqual([]);
    expect(toughOf(state)).toBe(1);
    expect(attached(state, id)).toBe(true);
  });
  it("a minion is not a treachery: revealing Hydra Mercenary does not offer it", () => {
    const { state: s } = analysis(2);
    const seen: string[] = [];
    villainPhase(s, { take: ["intelligence-analysis-interrupt"], seen }, FILLER, MERCENARY);
    expect(seen.filter((o) => o.endsWith("intelligence-analysis-interrupt"))).toEqual([]);
  });
  it("it is not a Hero Interrupt: in alter-ego form it cancels the treachery too", () => {
    const { id, state: s } = analysis(2, withSuit(furyGame(), { threat: 2 }));
    const { state } = villainPhase(s, { take: ["intelligence-analysis-interrupt"] }, FILLER, TOUGH);
    expect(toughOf(state)).toBe(0);
    expect(suitThreat(state)).toBe(1);
    expect(inDiscard(state, id)).toBe(true);
  });
  it("it is optional: declined, the upgrade stays and the threat stays", () => {
    const { id, state: s } = analysis(2);
    const { state } = villainPhase(s, {}, FILLER, TOUGH);
    expect(attached(state, id)).toBe(true);
    expect(suitThreat(state)).toBe(2);
  });
});

describe(`${AGENT}: Hero Response: after you resolve a Preparation card's ability, move 1 threat from a scheme to the suit`, () => {
  const agent = (state: GameState) => stagedInPlay(state, "50046", { attach: true });
  it("after EM Shield (Preparation) resolves: the main scheme loses 1 and the suit gains 1", () => {
    const withShield = stagedInPlay(heroWithSuit(), "50042", { attach: true });
    const { state: s0 } = agent(withShield.state);
    const s = patchInstance(s0, schemeOf(s0), { threat: 4 });
    const { state } = villainPhase(s, { take: ["em-shield-interrupt", "secret-agent-response"] }, MERCENARY);
    // The villain phase's own threat (+1) lands first, then the response moves 1 of it.
    expect(mainThreat(state)).toBe(4 + 1 - 1);
    expect(suitThreat(state)).toBe(1);
    expect(myDamage(state)).toBe(0);
  });
  it("after Eyepatch Camera resolves it moves one more: 1 placed on the suit by the camera, 1 moved by the agent", () => {
    const camera = stagedInPlay(heroWithSuit(), "50043", { attach: true });
    const { state: s0 } = agent(camera.state);
    const s = patchInstance(s0, schemeOf(s0), { threat: 4 });
    const { state } = villainPhase(
      s,
      { take: ["eyepatch-camera-interrupt", "secret-agent-response"], number: 1 },
      MERCENARY,
    );
    expect(mainThreat(state)).toBe(4 - 1);
    expect(suitThreat(state)).toBe(2);
  });
  it("it is a response the player may decline", () => {
    const withShield = stagedInPlay(heroWithSuit(), "50042", { attach: true });
    const { state: s0 } = agent(withShield.state);
    const s = patchInstance(s0, schemeOf(s0), { threat: 4 });
    const { state } = villainPhase(s, { take: ["em-shield-interrupt"] }, MERCENARY);
    expect(mainThreat(state)).toBe(4 + 1);
    expect(suitThreat(state)).toBe(0);
  });
  it("the ability of a card that is not Preparation (Fury's Flying Car) does not trigger it", () => {
    const car = stagedInPlay(heroWithSuit({ threat: 2 }), "50040");
    const { state: s0 } = agent(car.state);
    const s = patchInstance(patchInstance(s0, schemeOf(s0), { threat: 4 }), identityOf(s0), { exhausted: true });
    const seen: string[] = [];
    const { state } = run(s, { take: ["secret-agent-response"], seen }, use(P1, car.id, CAR));
    expect(seen.filter((o) => o.endsWith("secret-agent-response"))).toEqual([]);
    expect(mainThreat(state)).toBe(4);
    expect(suitThreat(state)).toBe(1);
  });
  it("the response is offered once per Preparation ability resolved", () => {
    const withShield = stagedInPlay(heroWithSuit(), "50042", { attach: true });
    const { state: s0 } = agent(withShield.state);
    const s = patchInstance(s0, schemeOf(s0), { threat: 4 });
    const targets: string[] = [];
    villainPhase(s, { take: ["em-shield-interrupt", "secret-agent-response"], seen: targets }, MERCENARY);
    expect(targets.filter((o) => o.endsWith("secret-agent-response"))).toHaveLength(1);
  });
  it("with no scheme holding threat there is nothing to move", () => {
    const withShield = stagedInPlay(heroWithSuit(), "50042", { attach: true });
    const { state: s0 } = agent(withShield.state);
    const seen: string[] = [];
    // The villain phase's threat goes to the main scheme before the attack, so it holds threat by then: stage a camera
    // instead and take it at the phase threat so the scheme stays empty when the agent's response is asked.
    const camera = stagedInPlay(s0, "50043", { attach: true });
    const s = patchInstance(camera.state, schemeOf(camera.state), { threat: 0 });
    const { state } = villainPhase(
      s,
      { take: ["eyepatch-camera-interrupt", "secret-agent-response"], number: 1, seen },
      MERCENARY,
    );
    expect(seen.filter((o) => o.endsWith("secret-agent-response"))).toEqual([]);
    expect(mainThreat(state)).toBe(0);
    expect(suitThreat(state)).toBe(1);
  });
});
