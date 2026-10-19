/**
 * "X cannot be dealt damage" (`RuleSpec cannotTakeDamage.stage: "dealt"`, docs/phase7-wave11-scenarios.md §S3.5):
 * Kingpin (`fne` 60159a/60160a), Jackknifed Tanker Truck (60131, "The villain cannot be dealt damage").
 *
 * RRG 1.8 "Damage" (p. 14) separates the damage dealt from the damage taken, and orders "would deal / be dealt"
 * abilities (step 1) ahead of tough (step 2) and "would take" abilities (step 3); "Cannot" (p. 11) is absolute. Damage
 * that cannot be dealt is never dealt, so no step of that list happens: no "would be dealt" interrupt (Out Front
 * 60129a's shape removes no threat), no tough card used or pierced (RRG 1.8 "Piercing", p. 32, acts on damage dealt),
 * and no "after … is dealt damage" response. The attack itself was made, so "after … attacks" still resolves, as for
 * an attack that deals no damage (RRG 1.8 "Attack (Enemy Activation)", p. 9; "Retaliate X", p. 38, keys off the
 * attack). Contrast "cannot take damage": dealt, then not taken (ruling March 6, 2026 R1; January 26, 2026 R3).
 */

import { flat } from "@mc/content";
import { describe, expect, it } from "vitest";
import type { EngineDeps, RuleSpec } from "./abilities.js";
import { replay } from "./engine.js";
import type { InstanceId } from "./ids.js";
import { mustInstance } from "./query.js";
import type { EffectSpec, TargetRef } from "./spec.js";
import type { GameState } from "./state.js";
import { depsOf, stubAbility } from "./testing/abilities.js";
import { stubEvent, stubMinion, stubSupport, stubTreachery, stubVillain } from "./testing/fixtures.js";
import { copiesOf, gameAtFirstTurn, minionEngagedWith, playerCardIntoPlay, playFree } from "./testing/wave3.js";

const n = (value: number) => ({ kind: "const", value }) as const;
const theVillain: TargetRef = { kind: "villain" };
const self: TargetRef = { kind: "self" };
const aVillain = { categories: ["villain" as const] };
const count = (counterType: string): EffectSpec => ({ kind: "addCounters", target: self, counterType, amount: n(1) });

const support = (id: string, rule: RuleSpec) => {
  const ability = stubAbility(`${id}.constant`, { trigger: { kind: "constant", rules: [rule] }, effects: [] });
  return { card: stubSupport({ id, cost: 0, abilities: [ability.ref] }), ability };
};
/** Jackknifed Tanker Truck's shape: "The villain cannot be dealt damage." */
const WALL = support("wall", { kind: "cannotTakeDamage", target: aVillain, stage: "dealt" });
/** The older "The villain cannot take damage.", for contrast. */
const SHIELD = support("shield", { kind: "cannotTakeDamage", target: aVillain });
const RULES = [WALL, SHIELD];

/** Out Front's shape (step 1): "When the villain would be dealt any amount of damage, …". */
const WOULD_BE_DEALT = stubAbility("dealt-watch.interrupt", {
  trigger: { kind: "interrupt", forced: true, wouldBeDealt: true, on: { on: "dealDamage", targetIs: aVillain } },
  effects: [count("wouldBeDealt")],
});
/** "After the villain is dealt damage, …". */
const AFTER_DEALT = stubAbility("after-dealt.response", {
  trigger: { kind: "response", forced: true, on: { on: "dealDamage", targetIs: aVillain } },
  effects: [count("dealt")],
});
/** "After you attack, …". */
const AFTER_ATTACK = stubAbility("after-attack.response", {
  trigger: { kind: "response", forced: true, on: { on: "attack", playerIs: "controller" } },
  effects: [count("attacked")],
});
const LISTENER = stubSupport({
  id: "listener",
  cost: 0,
  abilities: [WOULD_BE_DEALT.ref, AFTER_DEALT.ref, AFTER_ATTACK.ref],
});

const actionEvent = (id: string, effects: readonly EffectSpec[]) => {
  const ability = stubAbility(`${id}.action`, { trigger: { kind: "action" }, label: ["attack"], effects });
  return { card: stubEvent({ id, cost: 0, abilities: [ability.ref] }), ability };
};
const TOUGHEN = actionEvent("toughen", [{ kind: "giveStatus", target: theVillain, status: "tough" }]);
/** "Deal 5 damage to the villain and stun it": a valid target for the stun even when the damage cannot land. */
const STUNNING = actionEvent("stunning", [
  { kind: "attack", target: theVillain, amount: n(5) },
  { kind: "giveStatus", target: theVillain, status: "stunned" },
]);
/** The same with piercing. */
const PIERCING = actionEvent("piercing", [
  { kind: "attack", target: theVillain, amount: n(5), keywords: ["piercing"] },
  { kind: "giveStatus", target: theVillain, status: "stunned" },
]);
/** "Deal 2 damage to each enemy": one effect, several targets, dealt simultaneously (a `damageGroup`). */
const SWEEP = actionEvent("sweep", [
  { kind: "dealDamage", target: { kind: "each", query: { categories: ["enemy"] } }, amount: n(2) },
]);
/** "Deal 6 damage to the minion. This attack gains overkill." */
const SMASH = actionEvent("smash", [
  { kind: "attack", target: { kind: "each", query: { categories: ["minion"] } }, amount: n(6), overkill: true },
]);
const EVENTS = [TOUGHEN, STUNNING, PIERCING, SWEEP, SMASH];

const THUG = stubMinion({ id: "thug", atk: 0, sch: 0, hp: 3, boostIcons: 0 });
const BLANK = stubTreachery({ id: "blank", boostIcons: 0 });
/** A villain with retaliate 1 (RRG 1.8 "Retaliate X", p. 38: after it is attacked, 1 damage to the attacker). */
const SPIKED = stubVillain({
  id: "spiked",
  stages: [{ hp: flat(30), atk: 0, sch: 0, keywords: [{ name: "retaliate", value: 1 }] }],
});

const deps: EngineDeps = depsOf(
  WOULD_BE_DEALT,
  AFTER_DEALT,
  AFTER_ATTACK,
  ...RULES.map((r) => r.ability),
  ...EVENTS.map((e) => e.ability),
);
const CARDS = [LISTENER, ...RULES.map((r) => r.card), ...EVENTS.map((e) => e.card)];

interface Table {
  readonly state: GameState;
  readonly listener: InstanceId;
  readonly minion: InstanceId | null;
}

/** p1 in hero form with the listener and `rule` in play; the villain tough when `tough`; a 3 hp minion engaged. */
function start(
  rule: (typeof RULES)[number],
  tough = false,
  options: { readonly retaliate?: boolean; readonly minion?: boolean } = {},
): Table {
  const base = gameAtFirstTurn({
    cards: [...CARDS, THUG, BLANK, SPIKED],
    deps,
    ...(options.retaliate ? { villain: SPIKED } : {}),
    encounter: [...copiesOf(THUG.id, 2), ...copiesOf(BLANK.id, 28)],
    deck: [...CARDS.map((c) => c.id), ...EVENTS.flatMap((e) => copiesOf(e.card.id, 2))],
  });
  const hero: GameState = {
    ...base,
    players: base.players.map((p) => ({ ...p, identity: { ...p.identity, form: "hero" } })),
  };
  const listener = playerCardIntoPlay(hero, LISTENER.id);
  const ruled = playerCardIntoPlay(listener.state, rule.card.id);
  const engaged = options.minion ? minionEngagedWith(ruled.state, THUG.id) : null;
  const ready = engaged?.state ?? ruled.state;
  return {
    state: tough ? playFree(ready, deps, TOUGHEN.card.id).state : ready,
    listener: listener.id,
    minion: engaged?.id ?? null,
  };
}
const inPlay = (state: GameState, id: InstanceId): boolean => state.players.some((p) => p.playArea.includes(id));
const villain = (state: GameState) => mustInstance(state, state.villains[0]!.instanceId);

describe("§S3.5 'cannot be dealt damage': the damage is never dealt (RRG 1.8 'Damage', p. 14; 'Cannot', p. 11)", () => {
  it("no 'would be dealt' interrupt and no 'after … dealt' response; the attack still happened and stunned", () => {
    const { state, listener } = start(WALL);
    const { state: after, events } = playFree(state, deps, STUNNING.card.id);
    const counters = mustInstance(after, listener).counters;
    expect(counters["wouldBeDealt"]).toBeUndefined();
    expect(counters["dealt"]).toBeUndefined();
    expect(counters["attacked"]).toBe(1);
    expect(villain(after).damage).toBe(0);
    expect(villain(after).statuses.stunned).toBe(1);
    expect(events).toContainEqual(
      expect.objectContaining({ type: "damageNotDealt", targetInstanceId: villain(after).instanceId, amount: 5 }),
    );
    // Not a prevention: nothing was dealt to prevent.
    expect(events.some((e) => e.type === "damagePrevented")).toBe(false);
  });

  it("a piercing attack discards no tough card: no damage was dealt to pierce for", () => {
    const { state } = start(WALL, true);
    const { state: after } = playFree(state, deps, PIERCING.card.id);
    expect(villain(after).statuses.tough).toBe(1);
    expect(villain(after).damage).toBe(0);
  });

  it("a tough villain keeps its tough card without piercing too, and tough pre-empts no interrupt", () => {
    const { state } = start(WALL, true);
    const { state: after, events } = playFree(state, deps, STUNNING.card.id);
    expect(villain(after).statuses.tough).toBe(1);
    expect(events.some((e) => e.type === "interruptsPreempted")).toBe(false);
    expect(events.some((e) => e.type === "statusRemoved")).toBe(false);
  });

  it("retaliate and 'after you attack' still resolve: the attack was made (RRG 1.8 'Retaliate X', p. 38)", () => {
    const { state, listener } = start(WALL, false, { retaliate: true });
    const hero = state.players[0]!.identity.instanceId;
    const { state: after, events } = playFree(state, deps, STUNNING.card.id);
    expect(events).toContainEqual(expect.objectContaining({ type: "damageNotDealt", amount: 5 }));
    expect(mustInstance(after, listener).counters["attacked"]).toBe(1);
    expect(mustInstance(after, hero).damage).toBe(1);
    expect(villain(after).damage).toBe(0);
  });

  it("simultaneous damage: the villain's share is dropped, the minion's lands (a `damageGroup` member)", () => {
    const { state, listener, minion } = start(WALL, false, { minion: true });
    const { state: after, events } = playFree(state, deps, SWEEP.card.id);
    expect(events).toContainEqual(
      expect.objectContaining({ type: "damageNotDealt", targetInstanceId: villain(after).instanceId, amount: 2 }),
    );
    expect(events).toContainEqual(
      expect.objectContaining({ type: "damageDealt", targetInstanceId: minion, amount: 2 }),
    );
    expect(mustInstance(after, minion!).damage).toBe(2);
    expect(villain(after).damage).toBe(0);
    expect(mustInstance(after, listener).counters["wouldBeDealt"]).toBeUndefined();
  });

  it("overkill's spill onto the villain is not dealt; the minion's defeat is unaffected (RRG 1.8 'Overkill', p. 31)", () => {
    const { state, minion } = start(WALL, false, { minion: true });
    const { state: after, events } = playFree(state, deps, SMASH.card.id);
    const types = events.map((e) => e.type);
    const spilled = types.indexOf("overkillSpilled");
    expect(spilled).toBeGreaterThanOrEqual(0);
    expect(events[spilled]).toEqual(expect.objectContaining({ fromInstanceId: minion, amount: 3 }));
    expect(types.indexOf("damageNotDealt")).toBeGreaterThan(spilled);
    expect(events).toContainEqual(
      expect.objectContaining({ type: "damageNotDealt", targetInstanceId: villain(after).instanceId, amount: 3 }),
    );
    expect(inPlay(after, minion!)).toBe(false);
    expect(villain(after).damage).toBe(0);
  });

  it("contrast, 'cannot take damage': dealt, so 'would be dealt' and 'after … dealt' both fire", () => {
    const { state, listener } = start(SHIELD);
    const { state: after, events } = playFree(state, deps, STUNNING.card.id);
    const counters = mustInstance(after, listener).counters;
    expect(counters["wouldBeDealt"]).toBe(1);
    expect(counters["dealt"]).toBe(1);
    expect(counters["attacked"]).toBe(1);
    expect(villain(after).damage).toBe(0);
    expect(events).toContainEqual(expect.objectContaining({ type: "damagePrevented", reason: "cannotTakeDamage" }));
    expect(events.some((e) => e.type === "damageNotDealt")).toBe(false);
  });

  it("contrast, 'cannot take damage': piercing still discards the tough card (dealt, not taken)", () => {
    const { state } = start(SHIELD, true);
    const { state: after } = playFree(state, deps, PIERCING.card.id);
    expect(villain(after).statuses.tough).toBe(0);
    expect(villain(after).damage).toBe(0);
  });

  it("replays to the same state", () => {
    const { state } = start(WALL, true);
    const { session } = playFree(state, deps, PIERCING.card.id);
    const replayed = replay(session.log, deps);
    if (!replayed.ok) throw new Error(replayed.error.message);
    expect(replayed.state).toEqual(session.state);
  });
});
