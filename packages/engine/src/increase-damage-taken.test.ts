/**
 * docs/phase7-wave5.md §3.8: increasing the damage a character takes. Synthetic cards shaped like Bell Tower's Ringing
 * side (`sm` 27076b: "Increase all damage Venom takes by 1") and Wide Stance (`gmw` 16098: "Reduce the amount of damage
 * Nebula takes from each attack by 1").
 *
 * Sources: RRG 1.8 "Modifiers" (p. 29): additive and subtractive modifiers are applied together, and a value below zero is
 * treated as zero. §4 Q7 (proposed default): once per damage event, not per point.
 */

import { flat } from "@mc/content";
import { describe, expect, it } from "vitest";
import type { AbilityDefinition, EngineDeps, RuleSpec } from "./abilities.js";
import { replay } from "./engine.js";
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

const RINGING = constant("ringing.constant", [{ kind: "increaseDamageTaken", target: { self: true }, amount: 1 }]);
const STANCE = constant("stance.constant", [
  { kind: "reduceDamageTaken", target: { self: true }, amount: 1, fromAttack: true },
]);
type StubRef = (typeof RINGING)["ref"];
const villain = (id: string, abilities: readonly StubRef[]) =>
  stubVillain({ id, stages: [{ hp: flat(40), atk: 1, sch: 1, abilities }] });
const RUNG = villain("rung", [RINGING.ref]);
const RUNG_AND_STANCED = villain("rung-stanced", [RINGING.ref, STANCE.ref]);

const actionEvent = (id: string, effects: readonly EffectSpec[]) => {
  const ability = stubAbility(`${id}.action`, { trigger: { kind: "action" }, effects });
  return { card: stubEvent({ id, cost: 0, abilities: [ability.ref] }), ability };
};
const ATTACK_3 = actionEvent("attack-3", [{ kind: "attack", target: theVillain, amount: n(3) }]);
const ZAP_TWICE = actionEvent("zap-twice", [
  { kind: "dealDamage", target: theVillain, amount: n(2) },
  { kind: "dealDamage", target: theVillain, amount: n(2) },
]);
const ZAP_0 = actionEvent("zap-0", [{ kind: "dealDamage", target: theVillain, amount: n(0) }]);
const TOUGHEN = actionEvent("toughen", [{ kind: "giveStatus", target: theVillain, status: "tough" }]);
const EVENTS = [ATTACK_3, ZAP_TWICE, ZAP_0, TOUGHEN];

const deps: EngineDeps = depsOf(RINGING, STANCE, ...EVENTS.map((e) => e.ability));

function start(v: typeof RUNG): GameState {
  const state = gameAtFirstTurn({
    cards: [RUNG, RUNG_AND_STANCED, ...EVENTS.map((e) => e.card)],
    deps,
    villain: v,
    deck: EVENTS.flatMap((e) => copiesOf(e.card.id, 2)),
  });
  return { ...state, players: state.players.map((p) => ({ ...p, identity: { ...p.identity, form: "hero" } })) };
}
const villainDamage = (state: GameState): number => mustInstance(state, state.villains[0]!.instanceId).damage;

describe("§3.8 'Increase all damage Venom takes by 1'", () => {
  it("adds 1 to an attack's damage; replay deep-equal", () => {
    const { state, session } = playFree(start(RUNG), deps, ATTACK_3.card.id);
    expect(villainDamage(state)).toBe(4);
    const replayed = replay(session.log, deps);
    if (!replayed.ok) throw new Error(replayed.error.message);
    expect(replayed.state).toEqual(session.state);
  });

  it("adds 1 per damage event, not per point: two effects of 2 deal 6", () => {
    expect(villainDamage(playFree(start(RUNG), deps, ZAP_TWICE.card.id).state)).toBe(6);
  });

  it("does not turn no damage into damage", () => {
    expect(villainDamage(playFree(start(RUNG), deps, ZAP_0.card.id).state)).toBe(0);
  });

  it("is summed with a reduction: 3 + 1 - 1 = 3", () => {
    expect(villainDamage(playFree(start(RUNG_AND_STANCED), deps, ATTACK_3.card.id).state)).toBe(3);
  });

  it("a tough status still prevents the whole increased damage", () => {
    const tough = playFree(start(RUNG), deps, TOUGHEN.card.id).state;
    const state = playFree(tough, deps, ATTACK_3.card.id).state;
    expect(villainDamage(state)).toBe(0);
    expect(mustInstance(state, state.villains[0]!.instanceId).statuses.tough).toBe(0);
  });
});
