/**
 * "Excess damage dealt" counts the overkill value. RRG 1.8 "Overkill" (p. 31, revised in 1.8): "If a card ability counts
 * excess damage dealt, that ability counts the same value of excess damage that is calculated when resolving the
 * overkill keyword." That supersedes rulings Feb 8, 2026 (2) and Jan 26, 2026 (3), which measured excess *dealt* before
 * reductions (user decision 2026-09-25; PLAN.md's Overkill note; `resolve/event.ts` `excessDamageOf`).
 *
 * FFG's Feb 8 example, with synthetic cards: Hercules attacks Thumbelina (3 HP, "reduce the damage she takes by 1") for 6
 * with Golden Mace's overkill. She takes 5; overkill spills 5 − 3 = 2 onto the villain; Prince of Power, counting excess
 * damage dealt, now also reads 2 (the ruling said 3).
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

const reduceTakenBy = (id: string, amount: number) =>
  stubAbility(id, {
    trigger: {
      kind: "constant",
      rules: [{ kind: "reduceDamageTaken", target: { self: true }, amount, fromAttack: true }],
    },
    effects: [],
  });
/** Thumbelina's shape: 3 hit points, takes 1 less from each attack. */
const SHRINKING = reduceTakenBy("thumbelina.constant", 1);
const THUMBELINA = stubMinion({ id: "thumbelina", atk: 1, sch: 1, hp: 3, abilities: [SHRINKING.ref] });
/** The Jan 26 example's Nimrod (4 HP), with a constant "takes 3 less" standing in for Marked. */
const MARKED = reduceTakenBy("nimrod.constant", 3);
const NIMROD = stubMinion({ id: "nimrod", atk: 1, sch: 1, hp: 4, abilities: [MARKED.ref] });
const RECORDER = stubSupport({ id: "recorder", cost: 0 });

const actionEvent = (id: string, effects: readonly EffectSpec[]) => {
  const ability = stubAbility(`${id}.action`, { trigger: { kind: "action" }, effects });
  return { card: stubEvent({ id, cost: 0, abilities: [ability.ref] }), ability };
};
const recordExcess: EffectSpec = {
  kind: "addCounters",
  target: recorder,
  counterType: "excess",
  amount: { kind: "var", name: "hit.excessDealt" },
};
/** Golden Mace's 6 ATK with overkill, counting excess damage dealt as Prince of Power does. */
const MACE = actionEvent("mace", [
  { kind: "attack", target: theMinion, amount: n(6), overkill: true, bind: "hit" },
  recordExcess,
]);
/** Into the Fray's shape: no overkill, the same count. */
const FRAY = actionEvent("fray", [{ kind: "attack", target: theMinion, amount: n(6), bind: "hit" }, recordExcess]);
const EVENTS = [MACE, FRAY];

const deps: EngineDeps = depsOf(SHRINKING, MARKED, ...EVENTS.map((e) => e.ability));

function start(minion: typeof THUMBELINA): { state: GameState; recorder: InstanceId; minion: InstanceId } {
  const base = gameAtFirstTurn({
    cards: [RECORDER, THUMBELINA, NIMROD, ...EVENTS.map((e) => e.card)],
    deps,
    encounter: [...copiesOf(THUMBELINA.id, 2), ...copiesOf(NIMROD.id, 2)],
    deck: [RECORDER.id, ...EVENTS.flatMap((e) => copiesOf(e.card.id, 2))],
  });
  let state: GameState = {
    ...base,
    players: base.players.map((p) => ({ ...p, identity: { ...p.identity, form: "hero" } })),
  };
  const placed = playerCardIntoPlay(state, RECORDER.id);
  state = placed.state;
  const engaged = minionEngagedWith(state, minion.id);
  return { state: engaged.state, recorder: placed.id, minion: engaged.id };
}
const villainDamage = (state: GameState) => mustInstance(state, state.villains[0]!.instanceId).damage;

describe("RRG 1.8 p. 31: excess damage dealt is the overkill value", () => {
  it("Hercules vs. Thumbelina: 6 with overkill, she takes 5, 2 spills and 2 is counted (Feb 8, 2026 (2) said 3)", () => {
    const { state, recorder: id, minion } = start(THUMBELINA);
    const after = playFree(state, deps, MACE.card.id);
    expect(after.events).toContainEqual(
      expect.objectContaining({ type: "damageDealt", targetInstanceId: minion, amount: 5 }),
    );
    expect(after.events).toContainEqual(
      expect.objectContaining({ type: "overkillSpilled", fromInstanceId: minion, amount: 2 }),
    );
    expect(villainDamage(after.state)).toBe(2);
    expect(mustInstance(after.state, id).counters["excess"]).toBe(2);
  });

  it("without overkill the count is the same: what overkill would have spilled", () => {
    const { state, recorder: id } = start(THUMBELINA);
    const after = playFree(state, deps, FRAY.card.id).state;
    expect(villainDamage(after)).toBe(0);
    expect(mustInstance(after, id).counters["excess"]).toBe(2);
  });

  it("Rocket vs. Marked Nimrod: 6 against 4 HP, only 3 taken, so no excess (Jan 26, 2026 (3) said 2)", () => {
    const { state, recorder: id, minion } = start(NIMROD);
    const after = playFree(state, deps, FRAY.card.id).state;
    expect(mustInstance(after, minion).damage).toBe(3);
    expect(mustInstance(after, id).counters["excess"] ?? 0).toBe(0);
  });
});
