/**
 * docs/phase7-wave3.md §3.15: constant limits on the damage a character takes — `reduceDamageTaken` ("Reduce the amount
 * of damage Nebula takes from each attack by 1", Wide Stance / Kree Combat Armor) and `maxDamageTakenPerAttack` ("Nebula
 * cannot take more than 5 damage from a single attack", Cutthroat Ambition). Constants come before a tough status, so a
 * reduction to 0 keeps the tough card.
 *
 * Sources: RRG 1.8 General FAQ (p. 58: "A hero can keep their tough status card if: 1. A constant effect reduces the damage
 * the hero takes to zero"). Excess damage is measured on the reduced amount (RRG 1.8 "Overkill", p. 31, superseding
 * ruling Jan 26, 2026 (3); `excess-equals-overkill.test.ts`).
 */

import { flat } from "@mc/content";
import { describe, expect, it } from "vitest";
import type { AbilityDefinition, EngineDeps, RuleSpec } from "./abilities.js";
import { mustInstance } from "./query.js";
import type { EffectSpec, TargetRef } from "./spec.js";
import type { GameState } from "./state.js";
import { depsOf, stubAbility } from "./testing/abilities.js";
import { stubEvent, stubVillain } from "./testing/fixtures.js";
import { copiesOf, gameAtFirstTurn, playFree } from "./testing/wave3.js";

const n = (value: number) => ({ kind: "const", value }) as const;
const theVillain: TargetRef = { kind: "villain" };
const constant = (id: string, rules: readonly RuleSpec[]) => {
  const definition: AbilityDefinition = { trigger: { kind: "constant", rules }, effects: [] };
  return stubAbility(id, definition);
};

const WIDE_STANCE = constant("wide.constant", [
  { kind: "reduceDamageTaken", target: { self: true }, amount: 1, fromAttack: true },
]);
const CUTTHROAT = constant("cutthroat.constant", [
  { kind: "maxDamageTakenPerAttack", target: { self: true }, amount: 5 },
]);
const villain = (id: string, abilities: readonly StubRef[]) =>
  stubVillain({ id, stages: [{ hp: flat(40), atk: 1, sch: 1, abilities }] });
type StubRef = (typeof WIDE_STANCE)["ref"];
const STANCED = villain("stanced", [WIDE_STANCE.ref]);
const CAPPED = villain("capped", [CUTTHROAT.ref]);
const BOTH = villain("both", [WIDE_STANCE.ref, CUTTHROAT.ref]);

const actionEvent = (id: string, effects: readonly EffectSpec[]) => {
  const ability = stubAbility(`${id}.action`, { trigger: { kind: "action" }, effects });
  return { card: stubEvent({ id, cost: 0, abilities: [ability.ref] }), ability };
};
const attackFor = (amount: number) =>
  actionEvent(`attack-${amount}`, [{ kind: "attack", target: theVillain, amount: n(amount) }]);
const ATTACK_1 = attackFor(1);
const ATTACK_5 = attackFor(5);
const ATTACK_10 = attackFor(10);
const ZAP_5 = actionEvent("zap-5", [{ kind: "dealDamage", target: theVillain, amount: n(5) }]);
const TOUGHEN = actionEvent("toughen", [{ kind: "giveStatus", target: theVillain, status: "tough" }]);
const EVENTS = [ATTACK_1, ATTACK_5, ATTACK_10, ZAP_5, TOUGHEN];

const deps: EngineDeps = depsOf(WIDE_STANCE, CUTTHROAT, ...EVENTS.map((e) => e.ability));
const CARDS = [STANCED, CAPPED, BOTH, ...EVENTS.map((e) => e.card)];

function start(v: typeof STANCED): GameState {
  const state = gameAtFirstTurn({
    cards: CARDS,
    deps,
    villain: v,
    deck: EVENTS.flatMap((e) => copiesOf(e.card.id, 2)),
  });
  // Attacks are hero actions.
  return { ...state, players: state.players.map((p) => ({ ...p, identity: { ...p.identity, form: "hero" } })) };
}
const villainDamage = (state: GameState): number => mustInstance(state, state.villains[0]!.instanceId).damage;

describe("§3.15 constant limits on damage taken", () => {
  it("'reduce the damage taken from each attack by 1' reduces an attack's damage", () => {
    expect(villainDamage(playFree(start(STANCED), deps, ATTACK_5.card.id).state)).toBe(4);
  });

  it("…but not damage that is not from an attack", () => {
    expect(villainDamage(playFree(start(STANCED), deps, ZAP_5.card.id).state)).toBe(5);
  });

  it("'cannot take more than 5 damage from a single attack' caps an attack", () => {
    expect(villainDamage(playFree(start(CAPPED), deps, ATTACK_10.card.id).state)).toBe(5);
  });

  it("reductions apply first, then the cap: 10 − 1 = 9, capped at 5", () => {
    expect(villainDamage(playFree(start(BOTH), deps, ATTACK_10.card.id).state)).toBe(5);
    expect(villainDamage(playFree(start(BOTH), deps, ATTACK_5.card.id).state)).toBe(4);
  });

  it("a reduction to 0 keeps a tough status card (constants before status cards, RRG 1.8 p. 58)", () => {
    const tough = playFree(start(STANCED), deps, TOUGHEN.card.id).state;
    const { state, events } = playFree(tough, deps, ATTACK_1.card.id);
    expect(mustInstance(state, state.villains[0]!.instanceId).statuses.tough).toBe(1);
    expect(villainDamage(state)).toBe(0);
    expect(events).toContainEqual(expect.objectContaining({ type: "damagePrevented", reason: "reduced" }));
  });
});
