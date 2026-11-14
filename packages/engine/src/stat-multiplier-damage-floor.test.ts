/**
 * Three constant rules a custom-content pack needs (community pack `mephisto-nep`'s Bargain attachments):
 *
 * - `RuleSpec multiplyStat`: "Double the THW value of your identity" (Prideful Ambitions). RRG 1.8 "Modifiers" (p. 29):
 *   "all additive and subtractive modifiers are calculated before doubling and/or halving modifiers", "fractional values
 *   are rounded up after all modifiers have been applied", and below zero is zero.
 * - `RuleSpec minDamageTakenPerAttack`: "Your identity cannot take damage less than its DEF from each attack" (Slothful
 *   Endurance): a floor on one attack's damage event, applied after every modifier and before a cap.
 * - `RuleSpec resourcesGeneratedAsWild`: "Each resource you generate is considered a wild resource instead of its current
 *   resource" (Unquenchable Envy).
 *
 * Synthetic cards only.
 */

import { flat } from "@mc/content";
import { describe, expect, it } from "vitest";
import type { AbilityDefinition, EngineDeps, RuleSpec, StatModifierSpec } from "./abilities.js";
import { handCardResources, paidForMultiplied } from "./actions.js";
import { characterProfile, mustInstance, mustPlayer, remainingHitPoints } from "./query.js";
import { printedResourcesOf } from "./select.js";
import type { EffectSpec, TargetRef } from "./spec.js";
import type { GameState } from "./state.js";
import { depsOf, stubAbility } from "./testing/abilities.js";
import { stubEvent, stubSupport, stubVillain } from "./testing/fixtures.js";
import { giveCard } from "./testing/scenario.js";
import { copiesOf, gameAtFirstTurn, P1, P2, playerCardIntoPlay, playFree } from "./testing/wave3.js";

const n = (value: number) => ({ kind: "const", value }) as const;
const theVillain: TargetRef = { kind: "villain" };
const SELF = { self: true } as const;
const constant = (id: string, rules: readonly RuleSpec[], modifiers: readonly StatModifierSpec[] = []) => {
  const definition: AbilityDefinition = {
    trigger: { kind: "constant", rules, ...(modifiers.length > 0 ? { modifiers } : {}) },
    effects: [],
  };
  return stubAbility(id, definition);
};
type StubRef = ReturnType<typeof constant>["ref"];
const villain = (id: string, abilities: readonly StubRef[]) =>
  stubVillain({ id, stages: [{ hp: flat(40), atk: 3, sch: 3, abilities }] });

// ---- multiplyStat
const DOUBLE_ATK = constant("double-atk.constant", [{ kind: "multiplyStat", stat: "atk", factor: 2, target: SELF }]);
const PLUS_ONE_ATK = constant("plus-one-atk.constant", [], [{ stat: "atk", amount: 1, target: SELF }]);
const MINUS_FIVE_ATK = constant("minus-five-atk.constant", [], [{ stat: "atk", amount: -5, target: SELF }]);
const HALVE_ATK = constant("halve-atk.constant", [{ kind: "multiplyStat", stat: "atk", factor: 0.5, target: SELF }]);
const DOUBLE_HP = constant("double-hp.constant", [{ kind: "multiplyStat", stat: "hp", factor: 2, target: SELF }]);
const DOUBLED = villain("doubled", [DOUBLE_ATK.ref]);
const DOUBLED_PLUS = villain("doubled-plus", [DOUBLE_ATK.ref, PLUS_ONE_ATK.ref]);
const DOUBLED_TWICE = villain("doubled-twice", [DOUBLE_ATK.ref, DOUBLE_ATK.ref]);
const DOUBLED_NEGATIVE = villain("doubled-negative", [DOUBLE_ATK.ref, MINUS_FIVE_ATK.ref]);
const HALVED = villain("halved", [HALVE_ATK.ref]);
const HALVED_PLUS = villain("halved-plus", [HALVE_ATK.ref, PLUS_ONE_ATK.ref]);
const TOUGH_HIDE = villain("tough-hide", [DOUBLE_HP.ref]);
const PLAIN = villain("plain", []);

// ---- minDamageTakenPerAttack
const FLOOR_4 = constant("floor-4.constant", [{ kind: "minDamageTakenPerAttack", target: SELF, amount: 4 }]);
/** "… cannot take damage less than its SCH" — its own stat, read with the damaged card bound to `affected`. */
const FLOOR_OWN_SCH = constant("floor-sch.constant", [
  {
    kind: "minDamageTakenPerAttack",
    target: SELF,
    amount: { kind: "stat", of: { kind: "slot", slot: "affected" }, stat: "sch" },
  },
]);
const CAP_2 = constant("cap-2.constant", [{ kind: "maxDamageTakenPerAttack", target: SELF, amount: 2 }]);
const FLOORED = villain("floored", [FLOOR_4.ref]);
const FLOORED_BY_SCH = villain("floored-by-sch", [FLOOR_OWN_SCH.ref]);
const FLOORED_AND_CAPPED = villain("floored-capped", [FLOOR_4.ref, CAP_2.ref]);

const actionEvent = (id: string, effects: readonly EffectSpec[]) => {
  const ability = stubAbility(`${id}.action`, { trigger: { kind: "action" }, effects });
  return { card: stubEvent({ id, cost: 0, abilities: [ability.ref] }), ability };
};
const attackFor = (amount: number) =>
  actionEvent(`attack-${amount}`, [{ kind: "attack", target: theVillain, amount: n(amount) }]);
const ATTACK_0 = attackFor(0);
const ATTACK_1 = attackFor(1);
const ATTACK_6 = attackFor(6);
const ZAP_1 = actionEvent("zap-1", [{ kind: "dealDamage", target: theVillain, amount: n(1) }]);
const TOUGHEN = actionEvent("toughen", [{ kind: "giveStatus", target: theVillain, status: "tough" }]);
const EVENTS = [ATTACK_0, ATTACK_1, ATTACK_6, ZAP_1, TOUGHEN];

// ---- resourcesGeneratedAsWild
const ENVY_RULE = constant("envy.constant", [{ kind: "resourcesGeneratedAsWild", player: { kind: "controller" } }]);
const ENVY = stubSupport({ id: "envy", cost: 0, abilities: [ENVY_RULE.ref] });
const BRAIN = stubSupport({ id: "brain", cost: 0, resourceIcons: { mental: 2 } });
const MIXED = stubSupport({ id: "mixed", cost: 0, resourceIcons: { physical: 1, energy: 1, wild: 1 } });

const deps: EngineDeps = depsOf(
  DOUBLE_ATK,
  PLUS_ONE_ATK,
  MINUS_FIVE_ATK,
  HALVE_ATK,
  DOUBLE_HP,
  FLOOR_4,
  FLOOR_OWN_SCH,
  CAP_2,
  ENVY_RULE,
  ...EVENTS.map((e) => e.ability),
);
const VILLAINS = [
  DOUBLED,
  DOUBLED_PLUS,
  DOUBLED_TWICE,
  DOUBLED_NEGATIVE,
  HALVED,
  HALVED_PLUS,
  TOUGH_HIDE,
  PLAIN,
  FLOORED,
  FLOORED_BY_SCH,
  FLOORED_AND_CAPPED,
];
const CARDS = [...VILLAINS, ENVY, BRAIN, MIXED, ...EVENTS.map((e) => e.card)];

function start(v: (typeof VILLAINS)[number], players: 1 | 2 = 1): GameState {
  const state = gameAtFirstTurn({
    cards: CARDS,
    deps,
    villain: v,
    players,
    deck: [
      ...EVENTS.flatMap((e) => copiesOf(e.card.id, 2)),
      ...copiesOf(ENVY.id, 1),
      ...copiesOf(BRAIN.id, 2),
      ...copiesOf(MIXED.id, 1),
    ],
  });
  // Attacks are hero actions.
  return { ...state, players: state.players.map((p) => ({ ...p, identity: { ...p.identity, form: "hero" } })) };
}
const villainId = (state: GameState) => state.villains[0]!.instanceId;
const villainAtk = (state: GameState) => characterProfile(state, villainId(state), deps)!.atk;
const villainDamage = (state: GameState): number => mustInstance(state, villainId(state)).damage;

describe("multiplyStat: doubling and halving after every additive modifier (RRG 1.8 p. 29)", () => {
  it("double: 3 ATK is 6; with +1 ATK it is (3 + 1) x 2 = 8, not 3 x 2 + 1", () => {
    expect(villainAtk(start(PLAIN))).toBe(3);
    expect(villainAtk(start(DOUBLED))).toBe(6);
    expect(villainAtk(start(DOUBLED_PLUS))).toBe(8);
  });

  it("two doublings multiply together; a sum below 0 is 0 before doubling", () => {
    expect(villainAtk(start(DOUBLED_TWICE))).toBe(12);
    expect(villainAtk(start(DOUBLED_NEGATIVE))).toBe(0);
  });

  it("halve rounds up after every modifier: 3 / 2 = 2, (3 + 1) / 2 = 2", () => {
    expect(villainAtk(start(HALVED))).toBe(2);
    expect(villainAtk(start(HALVED_PLUS))).toBe(2);
  });

  it("only the named stat: doubling ATK leaves SCH; doubling hit points doubles max and remaining", () => {
    expect(characterProfile(start(DOUBLED), villainId(start(DOUBLED)), deps)!.sch).toBe(3);
    const state = start(TOUGH_HIDE);
    expect(characterProfile(state, villainId(state), deps)!.maxHp).toBe(80);
    expect(remainingHitPoints(state, villainId(state), deps)).toBe(80);
  });
});

describe("minDamageTakenPerAttack: a floor on one attack's damage", () => {
  it("an attack of 1 deals 4 under a floor of 4; an attack of 6 deals 6", () => {
    expect(villainDamage(playFree(start(FLOORED), deps, ATTACK_1.card.id).state)).toBe(4);
    expect(villainDamage(playFree(start(FLOORED), deps, ATTACK_6.card.id).state)).toBe(6);
  });

  it("damage that is not from an attack is not raised", () => {
    expect(villainDamage(playFree(start(FLOORED), deps, ZAP_1.card.id).state)).toBe(1);
  });

  it("an attack dealing 0 deals nothing: damage of 0 was never dealt", () => {
    expect(villainDamage(playFree(start(FLOORED), deps, ATTACK_0.card.id).state)).toBe(0);
  });

  it("the floor reads the damaged card's own stat live ('less than its SCH': 3)", () => {
    expect(villainDamage(playFree(start(FLOORED_BY_SCH), deps, ATTACK_1.card.id).state)).toBe(3);
  });

  it("a 'cannot take more than 2' cap keeps the last word over a floor of 4", () => {
    expect(villainDamage(playFree(start(FLOORED_AND_CAPPED), deps, ATTACK_1.card.id).state)).toBe(2);
  });

  it("a tough status card still prevents the raised damage", () => {
    const tough = playFree(start(FLOORED), deps, TOUGHEN.card.id).state;
    const { state } = playFree(tough, deps, ATTACK_1.card.id);
    expect(villainDamage(state)).toBe(0);
    expect(mustInstance(state, villainId(state)).statuses.tough).toBe(0);
  });

  it("no rule, no floor: an attack of 1 deals 1", () => {
    expect(villainDamage(playFree(start(PLAIN), deps, ATTACK_1.card.id).state)).toBe(1);
  });
});

describe("resourcesGeneratedAsWild: every resource the player generates is wild", () => {
  it("a hand card's 2 mental resources are 2 wild for its controller; its printed icons are unchanged", () => {
    const placed = playerCardIntoPlay(start(PLAIN), ENVY.id);
    const brain = giveCard(placed.state, P1, BRAIN.id);
    expect(handCardResources(brain.state, deps, brain.id, P1, null)).toEqual({
      physical: 0,
      mental: 0,
      energy: 0,
      wild: 2,
    });
    expect(printedResourcesOf(brain.state, brain.id, deps)).toMatchObject({ mental: 2, wild: 0 });
  });

  it("while paying for a card too, and a mix of types is the same number of wilds", () => {
    const placed = playerCardIntoPlay(start(PLAIN), ENVY.id);
    const mixed = giveCard(placed.state, P1, MIXED.id);
    const target = giveCard(mixed.state, P1, BRAIN.id);
    expect(handCardResources(target.state, deps, mixed.id, P1, target.id)).toEqual({
      physical: 0,
      mental: 0,
      energy: 0,
      wild: 3,
    });
    expect(
      paidForMultiplied(target.state, deps, target.id, { physical: 0, mental: 1, energy: 0, wild: 0 }, P1),
    ).toEqual({ physical: 0, mental: 0, energy: 0, wild: 1 });
  });

  it("another player is not bound by your rule; without the rule nothing changes", () => {
    const placed = playerCardIntoPlay(start(PLAIN, 2), ENVY.id);
    const theirs = giveCard(placed.state, P2, BRAIN.id);
    expect(handCardResources(theirs.state, deps, theirs.id, P2, null)).toMatchObject({ mental: 2, wild: 0 });
    const plain = giveCard(start(PLAIN), P1, BRAIN.id);
    expect(handCardResources(plain.state, deps, plain.id, P1, null)).toMatchObject({ mental: 2, wild: 0 });
    expect(mustPlayer(placed.state, P1).playArea).toContain(placed.id);
  });
});
