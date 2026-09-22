/**
 * docs/phase7-wave3.md §3.18: `RuleSpec excessDamageBonus`. Synthetic cards shaped like Follow Through (Aggression,
 * `gmw` 16045): "Hero Interrupt: When your hero's attack deals any amount of excess damage, increase that amount by 1."
 *
 * Sources: RRG 1.8 "Excess Damage" (p. 19), "Overkill" (p. 31); ruling Jan 26, 2026 (3) (excess is measured as dealt:
 * "Rocket deals 6 damage to Nimrod (4 HP), so excess damage dealt is 2").
 */

import { describe, expect, it } from "vitest";
import type { EngineDeps } from "./abilities.js";
import type { InstanceId } from "./ids.js";
import { mustInstance } from "./query.js";
import type { EffectSpec, TargetRef } from "./spec.js";
import type { GameState } from "./state.js";
import { depsOf, stubAbility } from "./testing/abilities.js";
import { stubEvent, stubMinion, stubSupport } from "./testing/fixtures.js";
import { copiesOf, gameAtFirstTurn, minionEngagedWith, playerCardIntoPlay, playFree } from "./testing/wave3.js";

const n = (value: number) => ({ kind: "const", value }) as const;
const theMinion: TargetRef = { kind: "each", query: { categories: ["minion"] } };
const recorder: TargetRef = { kind: "each", query: { categories: ["support"], name: "recorder" } };

const FOLLOW_THROUGH_RULE = stubAbility("follow-through.constant", {
  trigger: {
    kind: "constant",
    rules: [{ kind: "excessDamageBonus", attacker: { categories: ["hero"], controller: "you" }, amount: 1 }],
  },
  effects: [],
});
const FOLLOW_THROUGH = stubSupport({ id: "follow-through", cost: 0, abilities: [FOLLOW_THROUGH_RULE.ref] });
const RECORDER = stubSupport({ id: "recorder", cost: 0 });
const GRUNT = stubMinion({ id: "grunt", atk: 1, sch: 1, hp: 4 });

const actionEvent = (id: string, effects: readonly EffectSpec[]) => {
  const ability = stubAbility(`${id}.action`, { trigger: { kind: "action" }, effects });
  return { card: stubEvent({ id, cost: 0, abilities: [ability.ref] }), ability };
};
/** Into the Fray's shape: "Deal 6 damage to a minion. For each point of excess damage dealt by this attack, …". */
const INTO_THE_FRAY = actionEvent("into-the-fray", [
  { kind: "attack", target: theMinion, amount: n(6), bind: "hit" },
  { kind: "addCounters", target: recorder, counterType: "excess", amount: { kind: "var", name: "hit.excessDealt" } },
]);
/** An overkill attack: the excess spills onto the villain. */
const OVERKILL = actionEvent("overkill", [{ kind: "attack", target: theMinion, amount: n(6), overkill: true }]);
const EVENTS = [INTO_THE_FRAY, OVERKILL];

const deps: EngineDeps = depsOf(FOLLOW_THROUGH_RULE, ...EVENTS.map((e) => e.ability));

function start(withFollowThrough: boolean): { state: GameState; recorder: InstanceId } {
  const base = gameAtFirstTurn({
    cards: [FOLLOW_THROUGH, RECORDER, GRUNT, ...EVENTS.map((e) => e.card)],
    deps,
    encounter: copiesOf(GRUNT.id, 5),
    deck: [FOLLOW_THROUGH.id, RECORDER.id, ...EVENTS.flatMap((e) => copiesOf(e.card.id, 2))],
  });
  let state: GameState = {
    ...base,
    players: base.players.map((p) => ({ ...p, identity: { ...p.identity, form: "hero" } })),
  };
  const placed = playerCardIntoPlay(state, RECORDER.id);
  state = placed.state;
  if (withFollowThrough) state = playerCardIntoPlay(state, FOLLOW_THROUGH.id).state;
  return { state: minionEngagedWith(state, GRUNT.id).state, recorder: placed.id };
}

describe("§3.18 'increase that amount of excess damage by 1'", () => {
  it("without it, 6 damage to a 4-hit-point minion deals 2 excess", () => {
    const { state, recorder: id } = start(false);
    expect(mustInstance(playFree(state, deps, INTO_THE_FRAY.card.id).state, id).counters["excess"]).toBe(2);
  });

  it("with it, the same attack deals 3", () => {
    const { state, recorder: id } = start(true);
    expect(mustInstance(playFree(state, deps, INTO_THE_FRAY.card.id).state, id).counters["excess"]).toBe(3);
  });

  it("overkill spills the increased amount onto the villain", () => {
    const without = playFree(start(false).state, deps, OVERKILL.card.id).state;
    const withIt = playFree(start(true).state, deps, OVERKILL.card.id).state;
    const villainDamage = (state: GameState) => mustInstance(state, state.villains[0]!.instanceId).damage;
    expect(villainDamage(without)).toBe(2);
    expect(villainDamage(withIt)).toBe(3);
  });
});
