import { FALCON_CARDS, cardId, trait, type AllyCard, type SupportCard, type UpgradeCard } from "@mc/content";
import {
  activeEncounterDeck,
  applyCommand,
  legalActions,
  statBonus,
  type Command,
  type EngineDeps,
  type GameEvent,
  type GameState,
  type InstanceId,
  type Payment,
} from "@mc/engine";
import { describe, expect, it, vi } from "vitest";
import { abilityRefIds } from "../../../ability-refs.js";
import { after, discardTopOfEncounterDeckCost, draw, mergeRegistries, query, response } from "../../../dsl/index.js";
import { validateDefinition } from "../../../dsl/validate.js";
import {
  P1,
  P2,
  changeForm,
  endTurn,
  firstLegal,
  identityOf,
  inst,
  moveToHand,
  patchInstance,
  play,
  playerOf,
  resourceAbility,
  runWith,
  settle,
  use,
  type Picker,
} from "../../../testing/harness.js";
import { driveEventsPicking, encounterCardInVillainArea, stackSetAside, withForm } from "../../../testing/staging.js";
import { WAVE8_ABILITIES } from "../../../wave8/index.js";
import { FALCON_DEPS, engageMinion, falconGame, falconHeroGame, stagedInPlay } from "../testing.js";
import {
  FALCON_SUPPORT_UPGRADES_ALLIES as REGISTRY,
  FALCON_SUPPORT_UPGRADES_ALLIES_SKIPPED as SKIPPED,
} from "./support-upgrades-allies.js";

vi.setConfig({ testTimeout: 120_000 });

/**
 * Falcon's allies, supports and upgrades (53002, 53006 to 53013), docs/phase7-wave9.md section 8.4 and 3.42 to 3.47. The
 * printed precon `falcon-leadership` against Core's Rhino (14 hit points, ATK 2, stage 1 scheme). The encounter deck's top
 * cards are set by test surgery to Core cards of known boost areas: 01098 Armored Rhino Suit 0 icons, 01101 Hydra
 * Mercenary 1, 01099 Charge 2, 01118 Sonic Converter 3, 01121 Weapons Runner 0 icons and a star (1).
 */
const REDWING = "53002.redwing-action";
const FLOCK = "53006.falcons-flock-resource";
const KITCHEN = "53007.soup-kitchen-action";
const EVAC = "53008.aerial-evacuation-interrupt";
const RECON_ACTION = "53009.aerial-recon-action";
const RECON = "53009.aerial-recon-interrupt";
const AWARE = "53010.battlefield-awareness-interrupt";
const FIRE = "53011.draw-their-fire-response";
const TALON = "53012.talon-line-response";
const WEAVE_CONSTANT = "53013.vibranium-microweave-constant";
const WEAVE = "53013.vibranium-microweave-interrupt";
const EAGLE = "53001a.eagle-eyed";
const REFS = [REDWING, FLOCK, KITCHEN, EVAC, RECON_ACTION, RECON, AWARE, FIRE, TALON, WEAVE_CONSTANT, WEAVE];
const SKIPPED_REFS = [RECON_ACTION];
const CODES = ["53002", "53006", "53007", "53008", "53009", "53010", "53011", "53012", "53013"];

const ZERO = "01098";
const ONE = "01101";
const TWO = "01099";
const THREE = "01118";
const STAR = "01121";
const ENERGY = "53025";

/** Deps without the identity module: the encounter deck's top card stays facedown (nothing keeps it faceup). */
const NO_FALCON_IDENTITY: EngineDeps = { abilities: mergeRegistries(WAVE8_ABILITIES, REGISTRY) };

const card = <T>(code: string): T => FALCON_CARDS.find((c) => c.id === cardId(code)) as T;
const villainOf = (s: GameState): InstanceId => s.activeVillainId!;
const schemeOf = (s: GameState): InstanceId => s.mainScheme.instanceId;
const deckOf = (s: GameState) => activeEncounterDeck(s).deck;
const encounterDiscardOf = (s: GameState) => activeEncounterDeck(s).discard;
const handOf = (s: GameState): readonly InstanceId[] => playerOf(s, P1).hand;
const discardOf = (s: GameState): readonly InstanceId[] => playerOf(s, P1).discard;
const dmg = (s: GameState, id: InstanceId): number => inst(s, id).damage;
const threat = (s: GameState, id: InstanceId): number => inst(s, id).threat;
const formOf = (s: GameState, player = P1) => playerOf(s, player).identity.form;

/** The encounter deck's top cards turned (by surgery) into these cards, top first. */
function withTop(s: GameState, ...codes: readonly string[]): GameState {
  const deck = deckOf(s);
  return codes.reduce((acc, code, n) => patchInstance(acc, deck[n]!, { cardId: cardId(code) }), s);
}
const withThreat = (s: GameState, n: number): GameState => patchInstance(s, schemeOf(s), { threat: n });

interface Seen {
  readonly kind: string;
  readonly labels: readonly string[];
}
interface Plan {
  /** The label (start) to answer a chooseOption with; the first when absent. */
  readonly option?: string;
  /** The option id to answer a target prompt with, when offered (default: the first). */
  readonly target?: InstanceId;
  /** Trigger ids (suffixes) to take when offered; everything else is declined. */
  readonly take?: readonly string[];
  readonly seen?: Seen[];
}

/** A picker following `plan`, recording what it was asked. */
function planned(plan: Plan = {}): Picker {
  return (s) => {
    const c = s.pendingChoice!;
    plan.seen?.push({ kind: c.prompt.kind, labels: c.options.map((o) => o.label) });
    const ids = c.options.map((o) => o.optionId as string);
    switch (c.prompt.kind) {
      case "chooseTarget":
        return [plan.target !== undefined && ids.includes(plan.target) ? plan.target : ids[0]!];
      case "chooseOption": {
        const hit = plan.option === undefined ? 0 : c.options.findIndex((o) => o.label.startsWith(plan.option!));
        return [ids[Math.max(0, hit)]!];
      }
      case "chooseTriggers": {
        const hit = ids.find((o) => plan.take?.some((t) => o.endsWith(t)));
        return hit ? [hit] : [];
      }
      case "declareDefender":
        return [identityOf(s)];
      case "discardDownToHandSize":
        return c.options.slice(0, c.minSelections).map((o) => o.optionId);
      default:
        return firstLegal(s);
    }
  };
}

const run = (s: GameState, pick: Picker, ...commands: readonly Command[]) =>
  driveEventsPicking(FALCON_DEPS, s, pick, ...commands);
const refusal = (s: GameState, command: Command, deps: EngineDeps = FALCON_DEPS): string | undefined => {
  const result = applyCommand(s, command, deps);
  return result.ok ? undefined : result.error.message;
};
const offeredAbilities = (s: GameState, deps: EngineDeps = FALCON_DEPS): string[] => {
  const legal = legalActions(s, P1, deps);
  if (legal.kind !== "turn") throw new Error(legal.kind);
  return legal.legal.flatMap((a) => (a.action.kind === "useAbility" ? [a.action.abilityId as string] : []));
};
const canUse = (s: GameState, ability: string, deps: EngineDeps = FALCON_DEPS): boolean =>
  offeredAbilities(s, deps).includes(ability);
const ofType = <T extends GameEvent["type"]>(events: readonly GameEvent[], type: T) =>
  events.filter((e): e is Extract<GameEvent, { type: T }> => e.type === type);

describe("registry", () => {
  it("every printed ref of the nine cards is registered or skipped, with a reason for each skip", () => {
    const printed = CODES.flatMap((code) => abilityRefIds(card(code)));
    expect([...printed].sort()).toEqual([...REFS].sort());
    expect(Object.keys(REGISTRY).sort()).toEqual(REFS.filter((r) => !SKIPPED_REFS.includes(r)).sort());
    expect(Object.keys(SKIPPED).sort()).toEqual([...SKIPPED_REFS].sort());
    for (const reason of Object.values(SKIPPED)) expect(reason.length).toBeGreaterThan(40);
  });
  it.each(Object.keys(REGISTRY))("%s validates", (id) => {
    expect(validateDefinition(REGISTRY[id]!)).toEqual([]);
  });
  it("timing words", () => {
    expect(REGISTRY[REDWING]!.trigger).toMatchObject({ kind: "action", form: "hero" });
    expect(REGISTRY[FLOCK]!.trigger).toMatchObject({ kind: "resource" });
    expect(REGISTRY[KITCHEN]!.trigger).toMatchObject({ kind: "action", form: "alterEgo" });
    expect(REGISTRY[EVAC]!.trigger).toMatchObject({ kind: "interrupt", forced: false, form: "hero" });
    expect(REGISTRY[RECON]!.trigger).toMatchObject({ kind: "interrupt", forced: false });
    expect(REGISTRY[RECON]!.trigger).not.toHaveProperty("form");
    expect(REGISTRY[AWARE]!.trigger).toMatchObject({ kind: "interrupt", forced: false, form: "hero" });
    expect(REGISTRY[FIRE]!.trigger).toMatchObject({ kind: "response", forced: false, form: "hero" });
    expect(REGISTRY[TALON]!.trigger).toMatchObject({ kind: "response", forced: false, form: "hero" });
    expect(REGISTRY[WEAVE_CONSTANT]!.trigger).toMatchObject({ kind: "constant" });
    expect(REGISTRY[WEAVE]!.trigger).toMatchObject({ kind: "interrupt", forced: false, form: "hero" });
  });
  it("costs: every printed arrow is a cost, and the limits", () => {
    expect(REGISTRY[EVAC]!.cost).toEqual({ discardSelf: true });
    expect(REGISTRY[FIRE]!.cost).toEqual({ discardSelf: true });
    expect(REGISTRY[TALON]!.cost).toEqual({ discardSelf: true });
    expect(REGISTRY[WEAVE]!.cost).toEqual({ exhaustSelf: true });
    expect(REGISTRY[RECON]!.cost).toBeUndefined();
    expect(REGISTRY[FLOCK]!.limit).toMatchObject({ per: "paidCard" });
    expect(REGISTRY[REDWING]!.cost).toMatchObject({ returnToHand: expect.anything() });
    expect(REGISTRY[REDWING]!.cost).toMatchObject({ discardFromEncounterDeck: { amount: 1, slot: "top" } });
    expect(REGISTRY[AWARE]!.cost).toMatchObject({ exhaustSelf: true, discardFromEncounterDeck: { amount: 1 } });
  });
});

describe("printed data", () => {
  it("Redwing: unique Aerial Avenger Bird ally, cost 2, ATK 1, THW 1, 2 hit points, consequential damage 1 and 1", () => {
    const c = card<AllyCard>("53002");
    expect(c).toMatchObject({ type: "ally", cost: 2, unique: true, atk: 1, thw: 1, hp: 2 });
    expect(c.consequentialDamage).toEqual({ attack: 1, thwart: 1 });
    expect(c.resourceIcons).toEqual({ wild: 1 });
    expect(c.traits.map(String)).toEqual(["AERIAL", "AVENGER", "BIRD"]);
  });
  it("Falcon's Flock: Aerial Bird support, cost 2, [energy], Uses (5 bird counters)", () => {
    const c = card<SupportCard>("53006");
    expect(c).toMatchObject({ type: "support", cost: 2, unique: false, resourceIcons: { energy: 1 } });
    expect(c.keywords).toEqual([{ name: "uses", count: 5, counterType: "bird" }]);
    expect(c.traits.map(String)).toEqual(["AERIAL", "BIRD"]);
  });
  it("Soup Kitchen: Location support, cost 1, [mental]", () => {
    const c = card<SupportCard>("53007");
    expect(c).toMatchObject({ type: "support", cost: 1, unique: false, resourceIcons: { mental: 1 } });
    expect(c.traits.map(String)).toEqual(["LOCATION"]);
  });
  it.each([
    ["53008", 1, "physical", ["AERIAL", "PREPARATION"]],
    ["53009", 1, "mental", ["AERIAL", "TACTIC"]],
    ["53010", 2, "mental", ["AERIAL", "SKILL"]],
    ["53011", 1, "energy", ["AERIAL", "PREPARATION"]],
    ["53012", 2, "physical", ["ITEM"]],
    ["53013", 2, "energy", ["TECH", "WAKANDA"]],
  ] as const)("upgrade %s: cost %i, [%s], traits %j", (code, cost, icon, traits) => {
    const c = card<UpgradeCard>(code);
    expect(c).toMatchObject({ type: "upgrade", cost, resourceIcons: { [icon]: 1 } });
    expect(c.traits.map(String)).toEqual([...traits]);
  });
  it("Draw Their Fire costs 1 per player", () => {
    expect(card<UpgradeCard>("53011").costPerPlayer).toBe(true);
  });
});

/** Hero form, Redwing in play (ready), the encounter deck's top cards set to `top`. */
function redwing(top: readonly string[], base: GameState = falconHeroGame()) {
  const staged = stagedInPlay(withTop(base, ...top), "53002");
  return { ...staged, top: deckOf(staged.state)[0]! };
}
const useRedwing = (s: GameState, id: InstanceId, plan: Plan = {}, deps: EngineDeps = FALCON_DEPS) =>
  driveEventsPicking(deps, s, planned(plan), use(P1, id, REDWING));

describe("53002 Redwing", () => {
  it("played from hand for 2: enters play ready, no counters; Eagle-Eyed (he is Aerial) may then discard the top card", () => {
    const given = moveToHand(falconHeroGame(), P1, "53002", ENERGY);
    const [id, pay] = given.ids as [InstanceId, InstanceId];
    const { state } = run(given.state, planned(), play(P1, id, [pay]));
    expect(inst(state, id)).toMatchObject({ exhausted: false, faceup: true, damage: 0 });
    expect(playerOf(state, P1).playArea).toContain(id);
    expect(discardOf(state)).toContain(pay);
    const eagle = run(given.state, planned({ take: [EAGLE] }), play(P1, id, [pay]));
    expect(encounterDiscardOf(eagle.state).length).toBe(encounterDiscardOf(state).length + 1);
  });
  it.each([
    ["1 boost icon", ONE, 1],
    ["2 boost icons", TWO, 2],
    ["3 boost icons", THREE, 3],
    ["a star and no boost icon (the star is an icon)", STAR, 1],
  ])(
    "top card with %s: X = %i damage to the enemy, Redwing is back in hand and the card is discarded",
    (_n, code, x) => {
      const { state: s, id, top } = redwing([code]);
      const { state } = useRedwing(s, id, { option: "Deal" });
      expect(dmg(state, villainOf(state))).toBe(x);
      expect(handOf(state)).toContain(id);
      expect(playerOf(state, P1).playArea).not.toContain(id);
      expect(inst(state, id).exhausted).toBe(false);
      expect(encounterDiscardOf(state)).toContain(top);
      expect(deckOf(state)).not.toContain(top);
    },
  );
  it("the same card, the other choice: X threat is removed from a scheme (3 icons: 10 to 7), the villain is untouched", () => {
    const { state: s, id } = redwing([THREE], falconHeroGame());
    const { state } = useRedwing(withThreat(s, 10), id, { option: "Remove" });
    expect(threat(state, schemeOf(state))).toBe(7);
    expect(dmg(state, villainOf(state))).toBe(0);
  });
  it("the damage can go to a minion instead (chosen target); Rhino is untouched", () => {
    const { state: s, id } = redwing([TWO]);
    const withMinion = engageMinion(s, "01101", "m1");
    const { state } = useRedwing(withMinion, id, { option: "Deal", target: "m1" as InstanceId });
    expect(dmg(state, "m1" as InstanceId)).toBe(2);
    expect(dmg(state, villainOf(state))).toBe(0);
  });
  it("it is neither an attack nor a thwart: Retaliate and guard do not apply and no attack is made", () => {
    const { state: s, id } = redwing([TWO]);
    const { state, events } = useRedwing(engageMinion(s, "01101", "m1"), id, { option: "Deal" });
    expect(ofType(events, "triggerEvent").some((e) => e.event.kind === "attack")).toBe(false);
    expect(inst(state, identityOf(state)).damage).toBe(0);
  });
  it("costs are all paid before the choice: Redwing is already in hand and the card discarded when it is asked", () => {
    const { state: s, id, top } = redwing([THREE]);
    let atChoice: GameState | undefined;
    const pick: Picker = (st) => {
      if (st.pendingChoice!.prompt.kind === "chooseOption" && atChoice === undefined) atChoice = st;
      return planned({ option: "Deal" })(st);
    };
    driveEventsPicking(FALCON_DEPS, s, pick, use(P1, id, REDWING));
    expect(handOf(atChoice!)).toContain(id);
    expect(encounterDiscardOf(atChoice!)).toContain(top);
    expect(dmg(atChoice!, villainOf(atChoice!))).toBe(0);
  });
  it("faceup top card with no icons: the ability cannot be initiated (RRG FAQ Redwing #2; ruling January 26, 2026, Ruling 6 (1))", () => {
    const { state: s, id, top } = redwing([ZERO]);
    expect(canUse(s, REDWING)).toBe(false);
    expect(refusal(s, use(P1, id, REDWING))).toBeDefined();
    expect(deckOf(s)[0]).toBe(top);
  });
  it("a faceup star-only card is offered (the star is an icon): it is not 0", () => {
    const { state: s } = redwing([STAR]);
    expect(canUse(s, REDWING)).toBe(true);
  });
  it("a facedown top card (ruling March 19, 2026, Ruling 5): offered even when it prints nothing, and deals 0", () => {
    const base = falconHeroGame();
    const { state: s, id } = redwing([ZERO], base);
    expect(canUse(s, REDWING, NO_FALCON_IDENTITY)).toBe(true);
    const { state } = useRedwing(s, id, { option: "Deal" }, NO_FALCON_IDENTITY);
    expect(dmg(state, villainOf(state))).toBe(0);
    expect(handOf(state)).toContain(id);
    expect(encounterDiscardOf(state).length).toBeGreaterThan(0);
  });
  it("a facedown top card with icons resolves for what it prints", () => {
    const { state: s, id } = redwing([THREE]);
    const { state } = useRedwing(s, id, { option: "Deal" }, NO_FALCON_IDENTITY);
    expect(dmg(state, villainOf(state))).toBe(3);
  });
  it("exhausted Redwing cannot use it", () => {
    const { state: s, id } = redwing([TWO]);
    const tired = patchInstance(s, id, { exhausted: true });
    expect(canUse(tired, REDWING)).toBe(false);
  });
  it("in alter-ego form (a Hero Action) it is not offered", () => {
    const given = stagedInPlay(withTop(falconGame(), TWO), "53002");
    expect(formOf(given.state)).toBe("alterEgo");
    expect(canUse(given.state, REDWING)).toBe(false);
  });
  it("his basic attack and thwart: ATK 1, THW 1, and 1 consequential damage to him each time", () => {
    const { state: s, id } = redwing([TWO]);
    const attack: Command = {
      type: "basicAttack",
      playerId: P1,
      attackerInstanceId: id,
      targetInstanceId: villainOf(s),
    };
    const hit = run(s, planned(), attack).state;
    expect(dmg(hit, villainOf(hit))).toBe(1);
    expect(dmg(hit, id)).toBe(1);
    expect(inst(hit, id).exhausted).toBe(true);
    const thwart: Command = {
      type: "basicThwart",
      playerId: P1,
      thwarterInstanceId: id,
      schemeInstanceId: schemeOf(s),
    };
    const before = threat(withThreat(s, 5), schemeOf(s));
    const th = run(withThreat(s, 5), planned(), thwart).state;
    expect(threat(th, schemeOf(th))).toBe(before - 1);
    expect(dmg(th, id)).toBe(1);
  });
  it("with 1 damage already on his 2 hit points, the consequential damage of his attack defeats him", () => {
    const { state: s, id } = redwing([TWO]);
    const hurt = patchInstance(s, id, { damage: 1 });
    const attack: Command = {
      type: "basicAttack",
      playerId: P1,
      attackerInstanceId: id,
      targetInstanceId: villainOf(s),
    };
    const hit = run(hurt, planned(), attack).state;
    expect(playerOf(hit, P1).playArea).not.toContain(id);
    expect(discardOf(hit)).toContain(id);
  });
});

describe("53006 Falcon's Flock", () => {
  /** Redwing (cost 2, Aerial) in hand with `flocks` Falcon's Flocks in play (5 bird counters each) and one spare hand card. */
  function paying(flocks = 1, counters = 5, code = "53002") {
    let s = falconHeroGame();
    const flockIds: InstanceId[] = [];
    for (let n = 0; n < flocks; n++) {
      // The precon holds one Flock: further copies are made from hand cards by surgery.
      const hand = handOf(s)[0]!;
      const staged =
        n === 0
          ? stagedInPlay(s, "53006", { counters: { bird: counters } })
          : stagedInPlay(patchInstance(s, hand, { cardId: cardId("53006") }), "53006", {
              counters: { bird: counters },
            });
      s = staged.state;
      flockIds.push(staged.id);
    }
    const given = moveToHand(s, P1, code, ENERGY);
    const [target, spare] = given.ids as [InstanceId, InstanceId];
    return { state: given.state, flockIds, target, spare };
  }
  const via = (id: InstanceId): Payment => resourceAbility(id, FLOCK);

  it("played from hand for 2: enters play with 5 bird counters, ready", () => {
    const given = moveToHand(falconHeroGame(), P1, "53006");
    const id = given.ids[0]!;
    const [a, b] = handOf(given.state).filter((i) => i !== id);
    const { state } = run(given.state, planned(), play(P1, id, [a!, b!]));
    expect(inst(state, id).counters).toEqual({ bird: 5 });
    expect(inst(state, id).exhausted).toBe(false);
    expect(playerOf(state, P1).playArea).toContain(id);
  });
  it("pays 1 [energy] for an Aerial card: Redwing (cost 2) with the Flock and one hand card, one counter spent, 4 left", () => {
    const { state: s, flockIds, target, spare } = paying();
    const { state } = run(s, planned(), play(P1, target, [spare], { abilities: [via(flockIds[0]!)] }));
    expect(inst(state, flockIds[0]!).counters).toEqual({ bird: 4 });
    expect(inst(state, flockIds[0]!).exhausted).toBe(false);
    expect(playerOf(state, P1).playArea).toContain(target);
    expect(discardOf(state)).toContain(spare);
  });
  it("it generates exactly 1 resource: alone it does not pay for a cost-2 card", () => {
    const { state: s, flockIds, target } = paying();
    expect(refusal(s, play(P1, target, [], { abilities: [via(flockIds[0]!)] }))).toBeDefined();
  });
  it("limit once per card: one Flock cannot be used twice for the same card (4 counters stay after the refusal)", () => {
    const { state: s, flockIds, target } = paying(1);
    expect(refusal(s, play(P1, target, [], { abilities: [via(flockIds[0]!), via(flockIds[0]!)] }))).toBeDefined();
    expect(inst(s, flockIds[0]!).counters).toEqual({ bird: 5 });
  });
  it("two Flocks may each pay once for the same card: 2 resources, one counter from each", () => {
    const { state: s, flockIds, target } = paying(2);
    const { state } = run(s, planned(), play(P1, target, [], { abilities: flockIds.map(via) }));
    expect(playerOf(state, P1).playArea).toContain(target);
    expect(flockIds.map((id) => inst(state, id).counters)).toEqual([{ bird: 4 }, { bird: 4 }]);
  });
  it("a second card played the same turn takes another counter (the limit is per card, not per turn)", () => {
    const { state: s, flockIds, target, spare } = paying();
    const first = run(s, planned(), play(P1, target, [spare], { abilities: [via(flockIds[0]!)] })).state;
    const given = moveToHand(first, P1, "53003", ENERGY);
    const [event, pay] = given.ids as [InstanceId, InstanceId];
    const second = run(given.state, planned(), play(P1, event, [pay], { abilities: [via(flockIds[0]!)] })).state;
    expect(inst(second, flockIds[0]!).counters).toEqual({ bird: 3 });
  });
  it("it generates only for an Aerial card: Soup Kitchen (Location) cannot be paid with it", () => {
    const { state: s, flockIds } = paying();
    const given = moveToHand(s, P1, "53007");
    const kitchen = given.ids[0]!;
    expect(refusal(given.state, play(P1, kitchen, [], { abilities: [via(flockIds[0]!)] }))).toBeDefined();
  });
  it("the fifth counter spent: Falcon's Flock is discarded (Uses)", () => {
    const { state: s, flockIds, target, spare } = paying(1, 1);
    const { state } = run(s, planned(), play(P1, target, [spare], { abilities: [via(flockIds[0]!)] }));
    expect(playerOf(state, P1).playArea).not.toContain(flockIds[0]!);
    expect(discardOf(state)).toContain(flockIds[0]!);
    expect(playerOf(state, P1).playArea).toContain(target);
  });
  it("with no bird counters left it generates nothing", () => {
    const { state: s, flockIds, target, spare } = paying(1, 0);
    expect(refusal(s, play(P1, target, [spare], { abilities: [via(flockIds[0]!)] }))).toBeDefined();
  });
  it("it does not exhaust: the same Flock pays for another Aerial card in the same turn (already shown) and for an ability's cost", () => {
    const { state: s, flockIds } = paying();
    expect(inst(s, flockIds[0]!).exhausted).toBe(false);
  });
});

describe("53007 Soup Kitchen", () => {
  /** Alter-ego form with Soup Kitchen in play and `damage` on Sam Wilson. */
  function kitchen(damage = 0) {
    const staged = stagedInPlay(falconGame(), "53007");
    return { ...staged, state: patchInstance(staged.state, identityOf(staged.state), { damage }) };
  }
  const useKitchen = (s: GameState, id: InstanceId) => run(s, planned(), use(P1, id, KITCHEN));

  it("played from hand for 1: enters play ready", () => {
    const given = moveToHand(falconGame(), P1, "53007", ENERGY);
    const [id, pay] = given.ids as [InstanceId, InstanceId];
    const { state } = run(given.state, planned(), play(P1, id, [pay]));
    expect(playerOf(state, P1).playArea).toContain(id);
    expect(inst(state, id).exhausted).toBe(false);
  });
  it("exhausts Sam Wilson and Soup Kitchen, heals damage equal to his REC (3 of 5 damage: 2 left)", () => {
    const { state: s, id } = kitchen(5);
    expect(inst(s, identityOf(s)).damage).toBe(5);
    const { state } = useKitchen(s, id);
    expect(inst(state, id).exhausted).toBe(true);
    expect(inst(state, identityOf(state)).exhausted).toBe(true);
    expect(inst(state, identityOf(state)).damage).toBe(2);
  });
  it("with less damage than his REC it heals what there is (1 damage: 0 left)", () => {
    const { state: s, id } = kitchen(1);
    expect(inst(useKitchen(s, id).state, identityOf(s)).damage).toBe(0);
  });
  it("the next ally played this phase costs 2 less: Redwing (cost 2) is played for 0", () => {
    const { state: s, id } = kitchen(0);
    const used = useKitchen(s, id).state;
    const given = moveToHand(used, P1, "53002");
    const redwing = given.ids[0]!;
    const { state } = run(given.state, planned(), play(P1, redwing, []));
    expect(playerOf(state, P1).playArea).toContain(redwing);
  });
  it("the next support played also takes it: Falcon's Flock (cost 2) is played for 0", () => {
    const { state: s, id } = kitchen(0);
    const used = useKitchen(s, id).state;
    const given = moveToHand(used, P1, "53006");
    const { state } = run(given.state, planned(), play(P1, given.ids[0]!, []));
    expect(playerOf(state, P1).playArea).toContain(given.ids[0]!);
  });
  it("only the next card: a second ally costs full, and an event is not reduced", () => {
    const { state: s, id } = kitchen(0);
    const used = useKitchen(s, id).state;
    const given = moveToHand(used, P1, "53002");
    const first = given.ids[0]!;
    const second = handOf(given.state).find((i) => i !== first)!;
    const twins = patchInstance(given.state, second, { cardId: cardId("53002") });
    const after = run(twins, planned(), play(P1, first, [])).state;
    expect(refusal(after, play(P1, second, []))).toBeDefined();
    const ev = moveToHand(used, P1, "53003");
    expect(refusal(ev.state, play(P1, ev.ids[0]!, []))).toBeDefined();
  });
  it("it is spent when the phase ends: the next phase's ally costs full", () => {
    const { state: s, id } = kitchen(0);
    const used = useKitchen(s, id).state;
    const next = settle(
      run(used, planned(), endTurn()).state,
      firstLegal,
      (st) => st.step.phase === "player",
      FALCON_DEPS,
    );
    const given = moveToHand(next, P1, "53002");
    expect(refusal(given.state, play(P1, given.ids[0]!, []))).toBeDefined();
  });
  it("not offered with Sam Wilson exhausted, with Soup Kitchen exhausted, or in hero form (an Alter-Ego Action)", () => {
    const { state: s, id } = kitchen(2);
    expect(canUse(s, KITCHEN)).toBe(true);
    expect(canUse(patchInstance(s, identityOf(s), { exhausted: true }), KITCHEN)).toBe(false);
    expect(canUse(patchInstance(s, id, { exhausted: true }), KITCHEN)).toBe(false);
    const hero = run(s, planned(), changeForm()).state;
    expect(formOf(hero)).toBe("hero");
    expect(canUse(hero, KITCHEN)).toBe(false);
  });
});

describe("53010 Battlefield Awareness", () => {
  /** Hero form, the upgrade attached to Falcon, the deck top set to `top`. */
  function aware(top: readonly string[], base: GameState = falconHeroGame()) {
    return stagedInPlay(withTop(base, ...top), "53010", { attach: true });
  }
  const thwart = (s: GameState): Command => ({
    type: "basicThwart",
    playerId: P1,
    thwarterInstanceId: identityOf(s),
    schemeInstanceId: schemeOf(s),
  });
  const attackCmd = (s: GameState): Command => ({
    type: "basicAttack",
    playerId: P1,
    attackerInstanceId: identityOf(s),
    targetInstanceId: villainOf(s),
  });
  const offered = (take: boolean) => {
    const seen: Seen[] = [];
    return { seen, plan: { take: take ? ["53010.battlefield-awareness-interrupt"] : [], seen } satisfies Plan };
  };

  it.each([
    ["1 boost icon", ONE, 1],
    ["3 boost icons", THREE, 3],
    ["a star", STAR, 1],
  ])(
    "a basic thwart with a top card of %s: THW 2 + %i; the card is discarded and the upgrade exhausted",
    (_n, code, x) => {
      const { state: s, id } = aware([code]);
      const top = deckOf(s)[0]!;
      const { state } = run(withThreat(s, 10), planned(offered(true).plan), thwart(s));
      expect(threat(state, schemeOf(state))).toBe(10 - 2 - x);
      expect(inst(state, id).exhausted).toBe(true);
      expect(encounterDiscardOf(state)).toContain(top);
    },
  );
  it("a basic attack too: ATK 2 + 2 icons = 4", () => {
    const { state: s } = aware([TWO]);
    const { state } = run(s, planned(offered(true).plan), attackCmd(s));
    expect(dmg(state, villainOf(state))).toBe(4);
  });
  it("it is a choice: declined, the power is plain, the card stays on the deck and the upgrade stays ready", () => {
    const { state: s, id } = aware([THREE]);
    const top = deckOf(s)[0]!;
    const { seen, plan } = offered(false);
    const { state } = run(withThreat(s, 10), planned(plan), thwart(s));
    expect(seen.some((x) => x.kind === "chooseTriggers")).toBe(true);
    expect(threat(state, schemeOf(state))).toBe(8);
    expect(inst(state, id).exhausted).toBe(false);
    expect(deckOf(state)[0]).toBe(top);
  });
  it("the bonus is for that use only: the next basic power is plain", () => {
    const { state: s } = aware([THREE, THREE]);
    const first = run(withThreat(s, 10), planned(offered(true).plan), thwart(s)).state;
    expect(threat(first, schemeOf(first))).toBe(5);
    // Falcon is exhausted by the thwart; ready him by surgery and attack: the upgrade is exhausted, so a plain 2.
    const ready = patchInstance(first, identityOf(first), { exhausted: false });
    const second = run(ready, planned(offered(true).plan), attackCmd(ready)).state;
    expect(dmg(second, villainOf(second))).toBe(2);
  });
  it("faceup top card with no icons: not offered (the Redwing FAQ's reason), the power is plain", () => {
    const { state: s } = aware([ZERO]);
    const { seen, plan } = offered(true);
    const { state } = run(withThreat(s, 10), planned(plan), thwart(s));
    expect(seen.some((x) => x.kind === "chooseTriggers")).toBe(false);
    expect(threat(state, schemeOf(state))).toBe(8);
  });
  it("facedown top card (ruling March 19, 2026, Ruling 5): offered even with 0 icons, and gives +0", () => {
    const { state: s, id } = aware([ZERO]);
    const { seen, plan } = offered(true);
    const { state } = driveEventsPicking(NO_FALCON_IDENTITY, withThreat(s, 10), planned(plan), thwart(s));
    expect(seen.some((x) => x.kind === "chooseTriggers")).toBe(true);
    expect(threat(state, schemeOf(state))).toBe(8);
    expect(inst(state, id).exhausted).toBe(true);
  });
  it("a facedown card with icons gives +1 per icon", () => {
    const { state: s } = aware([TWO]);
    const { state } = driveEventsPicking(NO_FALCON_IDENTITY, withThreat(s, 10), planned(offered(true).plan), thwart(s));
    expect(threat(state, schemeOf(state))).toBe(6);
  });
  it("exhausted, it is not offered", () => {
    const { state: s, id } = aware([THREE]);
    const { seen, plan } = offered(true);
    run(withThreat(patchInstance(s, id, { exhausted: true }), 10), planned(plan), thwart(s));
    expect(seen.some((x) => x.kind === "chooseTriggers")).toBe(false);
  });
  it("only Falcon's own powers: Redwing's basic thwart does not offer it", () => {
    const { state: s } = aware([THREE]);
    const { state: withRedwing, id: redwingId } = stagedInPlay(s, "53002");
    const { seen, plan } = offered(true);
    const command: Command = {
      type: "basicThwart",
      playerId: P1,
      thwarterInstanceId: redwingId,
      schemeInstanceId: schemeOf(s),
    };
    const { state } = run(withThreat(withRedwing, 10), planned(plan), command);
    expect(seen.some((x) => x.kind === "chooseTriggers")).toBe(false);
    expect(threat(state, schemeOf(state))).toBe(9);
  });
});

describe("53011 Draw Their Fire", () => {
  /** Hero form, the upgrade attached, Hydra Mercenary engaged too: Rhino and the minion each attack Falcon this villain phase. */
  function fire(withUpgrade: boolean) {
    const base = withTop(engageMinion(falconHeroGame(), ONE, "m1"), ZERO, ZERO, ZERO, ZERO);
    return withUpgrade ? stagedInPlay(base, "53011", { attach: true }) : { state: base, id: undefined };
  }
  /** Drives the villain phase: takes the response (when `take`), defends with Falcon whenever he is offered. */
  function villainPhase(s: GameState, take: boolean, commands: readonly Command[] = [endTurn()]) {
    const prompts: { kind: string; ready: boolean; labels: readonly string[]; defenderOffered: boolean }[] = [];
    const pick: Picker = (st) => {
      const c = st.pendingChoice!;
      const ids = c.options.map((o) => o.optionId as string);
      prompts.push({
        kind: c.prompt.kind,
        ready: !inst(st, identityOf(st)).exhausted,
        labels: c.options.map((o) => o.label),
        defenderOffered: ids.includes(identityOf(st)),
      });
      if (c.prompt.kind === "chooseTriggers") {
        const mine = ids.find((o) => o.endsWith("53011.draw-their-fire-response"));
        return mine && take ? [mine] : [];
      }
      if (c.prompt.kind === "declareDefender") return ids.includes(identityOf(st)) ? [identityOf(st)] : [ids[0]!];
      return firstLegal(st);
    };
    const result = driveEventsPicking(FALCON_DEPS, s, pick, ...commands);
    return { ...result, prompts, defenses: prompts.filter((p) => p.kind === "declareDefender") };
  }

  it("played from hand for 1 per player (1 with one player): attached to Falcon, ready", () => {
    const given = moveToHand(falconHeroGame(), P1, "53011", ENERGY);
    const [id, pay] = given.ids as [InstanceId, InstanceId];
    const { state } = run(given.state, planned(), play(P1, id, [pay]));
    expect(inst(state, id).attachedTo).toBe(identityOf(state));
    expect(inst(state, id).exhausted).toBe(false);
  });
  it("offered as the villain phase begins; discarding it is the cost", () => {
    const { state: s, id } = fire(true);
    const { prompts, state } = villainPhase(s, true);
    const offer = prompts.find((p) => p.kind === "chooseTriggers");
    expect(offer?.labels).toContain("Draw Their Fire");
    expect(discardOf(state)).toContain(id!);
  });
  it("Falcon defends twice in the phase (Rhino, then the minion), with no exhaust: he is ready at the second declaration", () => {
    const { state: s } = fire(true);
    const { defenses, events } = villainPhase(s, true);
    expect(defenses).toHaveLength(2);
    expect(defenses.map((d) => d.ready)).toEqual([true, true]);
    expect(defenses.every((d) => d.defenderOffered)).toBe(true);
    const declared = ofType(events, "defenderDeclared").filter((e) => e.defenderInstanceId === identityOf(s));
    expect(declared).toHaveLength(2);
    expect(declared.every((e) => e.withoutExhausting === true)).toBe(true);
    expect(ofType(events, "cardExhausted").filter((e) => e.instanceId === identityOf(s))).toHaveLength(0);
  });
  it("and he is still ready after the phase", () => {
    const { state: s } = fire(true);
    const mid = villainPhase(s, true);
    expect(inst(mid.state, identityOf(mid.state)).exhausted).toBe(false);
  });
  it("without it (declined or absent) the first defense exhausts him and the second attack is undefended", () => {
    for (const [withUpgrade, take] of [
      [true, false],
      [false, false],
    ] as const) {
      const { state: s } = fire(withUpgrade);
      const { defenses, events } = villainPhase(s, take);
      // Only the first attack asks: with Falcon exhausted by it, the second has no defender to offer (no prompt at all).
      expect(defenses).toHaveLength(1);
      expect(defenses[0]!.ready).toBe(true);
      const declared = ofType(events, "defenderDeclared").filter((e) => e.defenderInstanceId === identityOf(s));
      expect(declared).toHaveLength(1);
      expect(declared[0]!.withoutExhausting).toBeUndefined();
    }
  });
  it("an exhausted Falcon may defend under it, and stays exhausted (RRG p. 15)", () => {
    const { state: s } = fire(true);
    // Cards ready as the player phase ends, so he is exhausted by surgery at the response window itself.
    const atOffer = settle(
      runWith(FALCON_DEPS, s, endTurn()),
      firstLegal,
      (st) => st.pendingChoice?.prompt.kind === "chooseTriggers",
      FALCON_DEPS,
    );
    const tired = patchInstance(atOffer, identityOf(atOffer), { exhausted: true });
    const { defenses, events, state } = villainPhase(tired, true, []);
    expect(defenses).toHaveLength(2);
    expect(defenses.every((d) => !d.ready && d.defenderOffered)).toBe(true);
    const declared = ofType(events, "defenderDeclared").filter((e) => e.defenderInstanceId === identityOf(s));
    expect(declared).toHaveLength(2);
    expect(declared.every((e) => e.withoutExhausting === true)).toBe(true);
    expect(inst(state, identityOf(state)).exhausted).toBe(true);
  });
  it("the rule ends with the phase: in the next villain phase (no upgrade left) the first defense exhausts him", () => {
    const { state: s } = fire(true);
    const first = villainPhase(s, true).state;
    const next = settle(first, firstLegal, (st) => st.step.phase === "player", FALCON_DEPS);
    const set = engageMinion(withTop(next, ZERO, ZERO, ZERO, ZERO), ONE, "m2");
    const second = villainPhase(set, false);
    expect(second.defenses[0]!.ready).toBe(true);
    const declared = ofType(second.events, "defenderDeclared").filter((e) => e.defenderInstanceId === identityOf(s));
    expect(declared.every((e) => e.withoutExhausting !== true)).toBe(true);
  });
  it("in alter-ego form (a Hero Response) it is not offered", () => {
    const base = withTop(falconGame(), ZERO, ZERO, ZERO, ZERO);
    const { state: s } = stagedInPlay(base, "53011", { attach: true });
    const { prompts } = villainPhase(s, true);
    expect(prompts.some((p) => p.labels.includes("Draw Their Fire"))).toBe(false);
  });
});

describe("53009 Aerial Recon", () => {
  /** The upgrade attached to Falcon holding `recon` counters; the next villain phase's cards are Armored Rhino Suits (0 icons). */
  function recon(counters: number, base: GameState = falconHeroGame()) {
    const staged = stagedInPlay(withTop(base, ZERO, ZERO, ZERO, ZERO), "53009", {
      attach: true,
      counters: { recon: counters },
    });
    return staged;
  }
  /** Ends the turn, taking Aerial Recon's interrupt whenever it is offered (`take`), and records what was offered. */
  function villainPhase(s: GameState, take: boolean, ends: readonly Command[] = [endTurn()]) {
    const offers: string[][] = [];
    const pick: Picker = (st) => {
      const c = st.pendingChoice!;
      if (c.prompt.kind === "chooseTriggers") {
        const ids = c.options.map((o) => o.optionId as string);
        offers.push(ids);
        const mine = ids.find((o) => o.endsWith(RECON));
        return mine && take ? [mine] : [];
      }
      if (c.prompt.kind === "declareDefender") return [c.options[0]!.optionId];
      return firstLegal(st);
    };
    return { ...driveEventsPicking(FALCON_DEPS, s, pick, ...ends), offers };
  }

  it("with 1 counter, taken: the villain phase deals the player nothing, the card stays on the deck, the counter is gone", () => {
    const { state: s, id } = recon(1);
    // Rhino's boost card is the first card; the card dealt to the player would be the second.
    const dealt = deckOf(s)[1]!;
    const { state, offers } = villainPhase(s, true);
    expect(offers.some((o) => o.some((x) => x.endsWith(RECON)))).toBe(true);
    expect(inst(state, id).counters.recon ?? 0).toBe(0);
    expect(deckOf(state)[0]).toBe(dealt);
    expect(playerOf(state, P1).dealtEncounter).toEqual([]);
    expect(inst(state, dealt).faceup).toBe(false);
  });
  it("declined: the player is dealt the card as usual and the counter stays", () => {
    const { state: s, id } = recon(1);
    const dealt = deckOf(s)[1]!;
    const { state } = villainPhase(s, false);
    expect(inst(state, id).counters).toEqual({ recon: 1 });
    expect(deckOf(state)).not.toContain(dealt);
  });
  it("with 0 counters it is not offered and the card is dealt", () => {
    const { state: s } = recon(0);
    const dealt = deckOf(s)[1]!;
    const { state, offers } = villainPhase(s, true);
    expect(offers.some((o) => o.some((x) => x.endsWith(RECON)))).toBe(false);
    expect(deckOf(state)).not.toContain(dealt);
  });
  it("with 3 counters one is removed per card dealt: 2 remain", () => {
    const { state: s, id } = recon(3);
    const { state } = villainPhase(s, true);
    expect(inst(state, id).counters).toEqual({ recon: 2 });
  });
  it("it is not a Hero Interrupt: it works in alter-ego form too", () => {
    const base = falconGame();
    const { state: s, id } = recon(1, base);
    expect(formOf(s)).toBe("alterEgo");
    const dealt = deckOf(s)[1]!;
    const { state } = villainPhase(s, true);
    expect(inst(state, id).counters.recon ?? 0).toBe(0);
    expect(deckOf(state)).toContain(dealt);
  });
  it("it hears a deal to any player: P2's card is replaced too, so a two-player villain phase deals one card", () => {
    const base = falconHeroGame({ twoPlayers: true });
    const { state: s, id } = recon(1, base);
    const { state } = villainPhase(s, true, [endTurn(P1), endTurn(P2)]);
    expect(inst(state, id).counters.recon ?? 0).toBe(0);
    expect(playerOf(state, P1).dealtEncounter.length + playerOf(state, P2).dealtEncounter.length).toBe(0);
  });
  it("the Hero Action (deal a player of your choice a facedown card, then place a counter) is skipped: nothing in the module offers it", () => {
    const { state: s } = recon(0);
    expect(canUse(s, RECON_ACTION)).toBe(false);
    expect(RECON_ACTION in REGISTRY).toBe(false);
    expect(SKIPPED[RECON_ACTION]).toContain("dealEncounterCardsCost");
  });
});

describe("53008 Aerial Evacuation", () => {
  /** Hero form, Redwing in play (his basic attack deals him 1 consequential damage), Aerial Evacuation on Falcon. */
  function evacTable(base: GameState = falconHeroGame()) {
    const withEvac = stagedInPlay(base, "53008", { attach: true });
    const redwing = stagedInPlay(withEvac.state, "53002");
    return { state: redwing.state, evac: withEvac.id, redwing: redwing.id };
  }
  const redwingAttack = (s: GameState, id: InstanceId): Command => ({
    type: "basicAttack",
    playerId: P1,
    attackerInstanceId: id,
    targetInstanceId: villainOf(s),
  });
  const takeEvac = (): Plan => ({ take: [EVAC] });

  it("played from hand for 1: attached to Falcon, ready", () => {
    const given = moveToHand(falconHeroGame(), P1, "53008", ENERGY);
    const [id, pay] = given.ids as [InstanceId, InstanceId];
    const { state } = run(given.state, planned(), play(P1, id, [pay]));
    expect(inst(state, id).attachedTo).toBe(identityOf(state));
  });
  it("Redwing's consequential damage is prevented in full, the card is discarded and Falcon changes to alter-ego form", () => {
    const { state: s, evac, redwing } = evacTable();
    const { state } = run(s, planned(takeEvac()), redwingAttack(s, redwing));
    expect(dmg(state, redwing)).toBe(0);
    expect(dmg(state, villainOf(state))).toBe(1);
    expect(discardOf(state)).toContain(evac);
    expect(formOf(state)).toBe("alterEgo");
  });
  it("declined: Redwing takes the 1 damage, Falcon stays in hero form, the upgrade stays", () => {
    const { state: s, evac, redwing } = evacTable();
    const { state } = run(s, planned(), redwingAttack(s, redwing));
    expect(dmg(state, redwing)).toBe(1);
    expect(formOf(state)).toBe("hero");
    expect(playerOf(state, P1).discard).not.toContain(evac);
  });
  it("it is a change by an effect: it does not spend the voluntary form change, so Falcon may change to hero form again", () => {
    const { state: s, redwing } = evacTable();
    const after = run(s, planned(takeEvac()), redwingAttack(s, redwing)).state;
    expect(formOf(after)).toBe("alterEgo");
    const back = run(after, planned(), changeForm()).state;
    expect(formOf(back)).toBe("hero");
  });
  it("another friendly character only: damage to Falcon himself does not offer it", () => {
    const { state: s, evac } = evacTable();
    const seen: Seen[] = [];
    const hurt = patchInstance(s, identityOf(s), { damage: 0 });
    // Rhino attacks Falcon in the villain phase; Falcon is undefended, so he is dealt damage himself.
    const pick: Picker = (st) => {
      const c = st.pendingChoice!;
      seen.push({ kind: c.prompt.kind, labels: c.options.map((o) => o.label) });
      if (c.prompt.kind === "declareDefender") return [c.options[0]!.optionId];
      return firstLegal(st);
    };
    const { state } = driveEventsPicking(FALCON_DEPS, withTop(hurt, ZERO, ZERO, ZERO), pick, endTurn());
    expect(inst(state, identityOf(state)).damage).toBeGreaterThan(0);
    expect(seen.some((x) => x.labels.includes("Aerial Evacuation"))).toBe(false);
    expect(playerOf(state, P1).discard).not.toContain(evac);
  });
  it("another player's hero: its damage is prevented, and both players change to alter-ego form", () => {
    const base = withForm(falconHeroGame({ twoPlayers: true }), { heroForm: 0 }, P2);
    const { state: s, evac } = evacTable(base);
    const minion = engageMinion(s, ONE, "m1", P2);
    const seen: Seen[] = [];
    const pick: Picker = (st) => {
      const c = st.pendingChoice!;
      seen.push({ kind: c.prompt.kind, labels: c.options.map((o) => o.label) });
      if (c.prompt.kind === "chooseTriggers") {
        const mine = c.options.find((o) => o.optionId.endsWith(EVAC));
        return mine ? [mine.optionId] : [];
      }
      if (c.prompt.kind === "declareDefender") return [c.options[0]!.optionId];
      return firstLegal(st);
    };
    const { state } = driveEventsPicking(
      FALCON_DEPS,
      withTop(minion, ZERO, ZERO, ZERO),
      pick,
      endTurn(P1),
      endTurn(P2),
    );
    expect(seen.some((x) => x.labels.includes("Aerial Evacuation"))).toBe(true);
    expect(dmg(state, identityOf(state, P2))).toBe(0);
    expect(discardOf(state)).toContain(evac);
    expect(formOf(state, P1)).toBe("alterEgo");
    expect(formOf(state, P2)).toBe("alterEgo");
  });
  it("a character that is not a hero (the ally) changes only Falcon", () => {
    const { state: s, redwing } = evacTable(falconHeroGame({ twoPlayers: true }));
    const { state } = run(s, planned(takeEvac()), redwingAttack(s, redwing));
    expect(formOf(state, P1)).toBe("alterEgo");
    expect(formOf(state, P2)).toBe("alterEgo"); // P2 starts in alter-ego form and stays there
  });
  it("in alter-ego form (a Hero Interrupt) it is not offered", () => {
    const { state: s } = evacTable(falconGame());
    const seen: Seen[] = [];
    run(s, planned({ take: [EVAC], seen }), endTurn());
    expect(seen.some((x) => x.labels.includes("Aerial Evacuation"))).toBe(false);
  });
});

describe("53012 Talon Line", () => {
  /** Hero form, Talon Line attached, Redwing and Eagle-Eyed's discard on `top` (top first); Redwing is played from hand. */
  function talon(top: readonly string[], base: GameState = falconHeroGame()) {
    const staged = stagedInPlay(withTop(base, ...top), "53012", { attach: true });
    const given = moveToHand(staged.state, P1, "53002");
    const redwing = given.ids[0]!;
    const pay = handOf(given.state)
      .filter((i) => i !== redwing)
      .slice(0, 2);
    return { state: given.state, talon: staged.id, redwing, pay };
  }
  interface Script {
    readonly options?: readonly string[];
    readonly targets?: readonly InstanceId[];
    readonly take?: readonly string[];
  }
  /** Takes Eagle-Eyed and Talon Line, then answers each option (prefix) and target in turn; records the option prompts. */
  function scripted(script: Script, seen: Seen[] = []): Picker {
    const options = [...(script.options ?? [])];
    const targets = [...(script.targets ?? [])];
    return (st) => {
      const c = st.pendingChoice!;
      const ids = c.options.map((o) => o.optionId as string);
      seen.push({ kind: c.prompt.kind, labels: c.options.map((o) => o.label) });
      switch (c.prompt.kind) {
        case "chooseTriggers": {
          const hit = ids.filter((o) => (script.take ?? [EAGLE, TALON]).some((t) => o.endsWith(t)));
          return hit.slice(0, 1);
        }
        case "chooseOption": {
          const want = options.shift();
          const at = want === undefined ? 0 : c.options.findIndex((o) => o.label.startsWith(want));
          return [ids[Math.max(0, at)]!];
        }
        case "chooseTarget": {
          const want = targets.shift();
          return [want !== undefined && ids.includes(want) ? want : ids[0]!];
        }
        case "discardDownToHandSize":
          return c.options.slice(0, c.minSelections).map((o) => o.optionId);
        default:
          return firstLegal(st);
      }
    };
  }
  /**
   * ENGINE GAP (reported): `abilityResolved` carries only the slots the ability held when it began to resolve (costs,
   * targets), "a slot the ability's effects bind later is not carried" (trigger-events.ts), and Eagle-Eyed (identity.ts)
   * binds `discarded` by an effect, so Talon Line cannot read it in the real game (the last test of this block shows
   * that). These tests exercise Talon Line's own script with a stand-in Eagle-Eyed that has the same trigger and
   * discards the top card as a cost bound to `discarded`, plus a harmless effect so that the resolution is announced.
   */
  const STAND_IN: EngineDeps = {
    abilities: {
      ...FALCON_DEPS.abilities,
      [EAGLE]: response(
        after.youPlayedCard(query([], { trait: trait("AERIAL") })),
        { cost: discardTopOfEncounterDeckCost("discarded") },
        draw(0),
      ),
    },
  };
  const playRedwing = (t: ReturnType<typeof talon>, pick: Picker, deps: EngineDeps = STAND_IN) =>
    driveEventsPicking(deps, t.state, pick, play(P1, t.redwing, t.pay));

  it("played from hand for 2: attached to Falcon, ready", () => {
    const given = moveToHand(falconHeroGame(), P1, "53012");
    const id = given.ids[0]!;
    const pay = handOf(given.state)
      .filter((i) => i !== id)
      .slice(0, 2);
    const { state } = run(given.state, planned(), play(P1, id, pay));
    expect(inst(state, id).attachedTo).toBe(identityOf(state));
  });
  it("after Eagle-Eyed discards a 1-icon card: one choice, here stun an enemy; Talon Line is discarded", () => {
    const t = talon([ONE]);
    const { state } = playRedwing(t, scripted({ options: ["Stun"] }));
    expect(inst(state, villainOf(state)).statuses.stunned).toBe(1);
    expect(discardOf(state)).toContain(t.talon);
  });
  it("one icon, ready a character you control: an exhausted Falcon is readied", () => {
    const t = talon([ONE]);
    const tired = { ...t, state: patchInstance(t.state, identityOf(t.state), { exhausted: true }) };
    const { state } = playRedwing(tired, scripted({ options: ["Ready"], targets: [identityOf(tired.state)] }));
    expect(inst(state, identityOf(state)).exhausted).toBe(false);
    expect(inst(state, villainOf(state)).statuses.stunned).toBe(0);
  });
  it("three icons: three separate choices, here ready Falcon and stun Rhino and a minion", () => {
    const base = engageMinion(falconHeroGame(), ONE, "m1");
    const t = talon([THREE], base);
    const tired = { ...t, state: patchInstance(t.state, identityOf(t.state), { exhausted: true }) };
    const seen: Seen[] = [];
    const { state } = playRedwing(
      tired,
      scripted(
        {
          options: ["Ready", "Stun", "Stun"],
          targets: [identityOf(tired.state), villainOf(tired.state), "m1" as InstanceId],
        },
        seen,
      ),
    );
    expect(seen.filter((x) => x.kind === "chooseOption")).toHaveLength(3);
    expect(inst(state, identityOf(state)).exhausted).toBe(false);
    expect(inst(state, villainOf(state)).statuses.stunned).toBe(1);
    expect(inst(state, "m1" as InstanceId).statuses.stunned).toBe(1);
  });
  it("a star counts as an icon: a Serpent Soldier-like card of one star gives one choice", () => {
    const t = talon([STAR]);
    const seen: Seen[] = [];
    playRedwing(t, scripted({}, seen));
    expect(seen.filter((x) => x.kind === "chooseOption")).toHaveLength(1);
  });
  it("0 icons: Talon Line is not offered (the Redwing FAQ's reason, flagged in the spec) and stays attached", () => {
    const t = talon([ZERO]);
    const seen: Seen[] = [];
    const { state } = playRedwing(t, scripted({}, seen));
    expect(seen.some((x) => x.kind === "chooseTriggers" && x.labels.includes("Talon Line"))).toBe(false);
    expect(inst(state, t.talon).attachedTo).toBe(identityOf(state));
  });
  it("only after Eagle-Eyed: declined Eagle-Eyed, or a card that is not Aerial, offers nothing", () => {
    const t = talon([THREE]);
    const seen: Seen[] = [];
    const { state } = playRedwing(t, scripted({ take: [] }, seen));
    expect(seen.some((x) => x.labels.includes("Talon Line"))).toBe(false);
    expect(inst(state, t.talon).attachedTo).toBe(identityOf(state));
    const kitchen = moveToHand(talon([THREE]).state, P1, "53007");
    const seen2: Seen[] = [];
    driveEventsPicking(
      FALCON_DEPS,
      kitchen.state,
      scripted({}, seen2),
      play(
        P1,
        kitchen.ids[0]!,
        handOf(kitchen.state)
          .filter((i) => i !== kitchen.ids[0])
          .slice(0, 1),
      ),
    );
    expect(seen2.some((x) => x.labels.includes("Talon Line"))).toBe(false);
  });
  it.fails("REAL FLOW (engine gap, passes only once the engine carries slots an effect binds): Talon Line is offered after the real Eagle-Eyed", () => {
    const t = talon([THREE]);
    const seen: Seen[] = [];
    playRedwing(t, scripted({}, seen), FALCON_DEPS);
    expect(seen.some((x) => x.kind === "chooseTriggers" && x.labels.includes("Talon Line"))).toBe(true);
  });
  it("Q35 = A (docs/phase7-wave9.md section 4.1): a Serpent Soldier Serpent Solutions deals away after Eagle-Eyed discards it is not counted by Eagle-Eyed, but Talon Line still reads its printed icon", () => {
    const base = encounterCardInVillainArea(stackSetAside(falconHeroGame(), "53031"), "53031", 6).state;
    const t = talon([ZERO], base);
    const soldier = deckOf(t.state)[0]!;
    const asSoldier = { ...t, state: patchInstance(t.state, soldier, { cardId: cardId("53032") }) };
    const seen: Seen[] = [];
    const { state } = playRedwing(asSoldier, scripted({ options: ["Stun"] }, seen));
    expect(playerOf(state, P1).dealtEncounter).toContain(soldier);
    expect(encounterDiscardOf(state)).not.toContain(soldier);
    expect(seen.filter((x) => x.kind === "chooseOption")).toHaveLength(1);
    expect(inst(state, villainOf(state)).statuses.stunned).toBe(1);
  });
});

describe("53013 Vibranium Microweave", () => {
  /** Hero form, the upgrade attached to Falcon. */
  const weave = (base: GameState = falconHeroGame()) => stagedInPlay(base, "53013", { attach: true });
  const undefended = (s: GameState, take: boolean, seen: Seen[] = []) => {
    const pick: Picker = (st) => {
      const c = st.pendingChoice!;
      seen.push({ kind: c.prompt.kind, labels: c.options.map((o) => o.label) });
      if (c.prompt.kind === "chooseTriggers") {
        const mine = c.options.find((o) => o.optionId.endsWith(WEAVE));
        return mine && take ? [mine.optionId] : [];
      }
      if (c.prompt.kind === "declareDefender") return [c.options[0]!.optionId];
      return firstLegal(st);
    };
    return driveEventsPicking(FALCON_DEPS, withTop(s, ZERO, ZERO, ZERO), pick, endTurn());
  };

  it("played from hand for 2: attached to Falcon, ready", () => {
    const given = moveToHand(falconHeroGame(), P1, "53013");
    const id = given.ids[0]!;
    const pay = handOf(given.state)
      .filter((i) => i !== id)
      .slice(0, 2);
    const { state } = run(given.state, planned(), play(P1, id, pay));
    expect(inst(state, id).attachedTo).toBe(identityOf(state));
    expect(inst(state, id).exhausted).toBe(false);
  });
  it("Falcon gets +1 DEF while it is attached (and not without it)", () => {
    const { state: s } = weave();
    expect(statBonus(s, FALCON_DEPS, identityOf(s), "def")).toBe(1);
    expect(statBonus(falconHeroGame(), FALCON_DEPS, identityOf(falconHeroGame()), "def")).toBe(0);
  });
  it("Rhino's undefended attack (ATK 2): prevents 1, so Falcon takes 1, and Rhino takes 1 damage; the upgrade is exhausted", () => {
    const { state: s, id } = weave();
    const { state } = undefended(s, true);
    expect(inst(state, identityOf(state)).damage).toBe(1);
    expect(dmg(state, villainOf(state))).toBe(1);
    expect(inst(state, id).exhausted).toBe(true);
  });
  it("declined: Falcon takes all 2 and Rhino none", () => {
    const { state: s, id } = weave();
    const { state } = undefended(s, false);
    expect(inst(state, identityOf(state)).damage).toBe(2);
    expect(dmg(state, villainOf(state))).toBe(0);
    expect(inst(state, id).exhausted).toBe(false);
  });
  it("the 1 damage goes to an enemy of the player's choice: here a minion", () => {
    const { state: s } = weave(engageMinion(falconHeroGame(), ONE, "m1"));
    const seen: Seen[] = [];
    const pick: Picker = (st) => {
      const c = st.pendingChoice!;
      seen.push({ kind: c.prompt.kind, labels: c.options.map((o) => o.label) });
      if (c.prompt.kind === "chooseTriggers") {
        const mine = c.options.find((o) => o.optionId.endsWith(WEAVE));
        return mine ? [mine.optionId] : [];
      }
      if (c.prompt.kind === "chooseTarget") return ["m1"];
      if (c.prompt.kind === "declareDefender") return [c.options[0]!.optionId];
      return firstLegal(st);
    };
    const { state } = driveEventsPicking(FALCON_DEPS, withTop(s, ZERO, ZERO, ZERO), pick, endTurn());
    expect(dmg(state, "m1" as InstanceId)).toBe(1);
    expect(seen.some((x) => x.kind === "chooseTarget")).toBe(true);
  });
  it("exhausted by the first hit, it is not offered for the second: Rhino 2 (prevent 1) then the minion 1 (all taken)", () => {
    const { state: s } = weave(engageMinion(falconHeroGame(), ONE, "m1"));
    const seen: Seen[] = [];
    const { state } = undefended(s, true, seen);
    expect(seen.filter((x) => x.labels.includes("Vibranium Microweave"))).toHaveLength(1);
    expect(inst(state, identityOf(state)).damage).toBe(2);
  });
  it("defending with DEF 3: Rhino's ATK 2 is stopped, no damage is taken and the interrupt is not offered", () => {
    const { state: s } = weave();
    const seen: Seen[] = [];
    const pick: Picker = (st) => {
      const c = st.pendingChoice!;
      seen.push({ kind: c.prompt.kind, labels: c.options.map((o) => o.label) });
      if (c.prompt.kind === "declareDefender") return [identityOf(st)];
      return firstLegal(st);
    };
    const { state } = driveEventsPicking(FALCON_DEPS, withTop(s, ZERO, ZERO, ZERO), pick, endTurn());
    expect(inst(state, identityOf(state)).damage).toBe(0);
    expect(seen.some((x) => x.labels.includes("Vibranium Microweave"))).toBe(false);
  });
});
