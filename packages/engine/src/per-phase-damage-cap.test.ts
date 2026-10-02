/**
 * docs/phase7-wave6.md §3.4: "Nimrod cannot take more than 3 damage each phase." (`mut_gen` 32166), as
 * `RuleSpec maxDamageTakenPerAttack` with `per: "phase"` on a synthetic minion.
 *
 * Sources: §4.1 Q9 (amended): damage beyond a cap is neither taken nor prevented, and only damage taken counts toward
 * the tally. Excess damage is measured on the damage taken, after the cap (RRG 1.8 "Overkill", p. 31, superseding
 * ruling Jan 26, 2026 (3), whose Into the Fray example is this very card). RRG 1.8 "Round Overview" (p. 4): a round is
 * a player phase then a villain phase, so the tally starts over when each hands over to the next.
 */

import { flat, type CardId } from "@mc/content";
import { describe, expect, it } from "vitest";
import type { AbilityDefinition, EngineDeps, RuleSpec } from "./abilities.js";
import type { Command } from "./commands.js";
import { replay } from "./engine.js";
import type { GameEvent } from "./events.js";
import type { InstanceId } from "./ids.js";
import { mustInstance } from "./query.js";
import type { EffectSpec, TargetRef } from "./spec.js";
import type { CardInstance, GameState } from "./state.js";
import { depsOf, stubAbility } from "./testing/abilities.js";
import { stubEvent, stubMinion, stubSideScheme, stubSupport, stubVillain } from "./testing/fixtures.js";
import {
  copiesOf,
  encounterCardInVillainArea,
  gameAtFirstTurn,
  minionEngagedWith,
  P1,
  playerCardIntoPlay,
  playFree,
} from "./testing/wave3.js";
import { TREACHERY } from "./testing/scenario.js";

const n = (value: number) => ({ kind: "const", value }) as const;
const eachMinion: TargetRef = { kind: "each", query: { categories: ["minion"] } };
const recorder: TargetRef = { kind: "each", query: { categories: ["support"], name: "recorder" } };

const constant = (id: string, rules: readonly RuleSpec[]) =>
  stubAbility(id, { trigger: { kind: "constant", rules }, effects: [] } satisfies AbilityDefinition);
/** "Nimrod cannot take more than 3 damage each phase." */
const NIMROD_RULE = constant("nimrod.constant", [
  { kind: "maxDamageTakenPerAttack", target: { self: true }, amount: 3, per: "phase" },
]);
/** Cutthroat Ambition's per-attack cap beside it, on a second minion: the two shapes of the one rule kind. */
const PER_ATTACK_RULE = constant("both.per-attack", [
  { kind: "maxDamageTakenPerAttack", target: { self: true }, amount: 2 },
]);
/** §3.3's shape on minions: "… cannot have more than 4 sustained damage." */
const SUSTAINED_RULE = constant("sustained.constant", [
  { kind: "maxSustainedDamage", target: { categories: ["minion"] }, amount: n(4) },
]);
/** "Forced Response: After the villain phase begins, deal 5 damage to each minion." */
const TURRET_RULE = stubAbility("turret.response", {
  trigger: { kind: "response", forced: true, on: { on: "phaseBeginning", eventIs: { phase: "villain" } } },
  effects: [{ kind: "dealDamage", target: eachMinion, amount: n(5) }],
} satisfies AbilityDefinition);

const NIMROD = stubMinion({ id: "nimrod", atk: 0, sch: 0, hp: 20, abilities: [NIMROD_RULE.ref] });
const FRAIL = stubMinion({ id: "frail", atk: 0, sch: 0, hp: 4, abilities: [NIMROD_RULE.ref] });
const BOTH = stubMinion({ id: "both", atk: 0, sch: 0, hp: 20, abilities: [NIMROD_RULE.ref, PER_ATTACK_RULE.ref] });
const SUSTAINED = stubSideScheme({ id: "sustained", startingThreat: 3, abilities: [SUSTAINED_RULE.ref] });
const VILLAIN = stubVillain({ id: "master-mold", stages: [{ hp: flat(30), atk: 0, sch: 0 }] });
const RECORDER = stubSupport({ id: "recorder", cost: 0 });
const TURRET = stubSupport({ id: "turret", cost: 0, abilities: [TURRET_RULE.ref] });

const actionEvent = (id: string, effects: readonly EffectSpec[], label?: "attack") => {
  const ability = stubAbility(`${id}.action`, {
    trigger: { kind: "action" },
    ...(label ? { label: [label] } : {}),
    effects,
  });
  return { card: stubEvent({ id, cost: 0, abilities: [ability.ref] }), ability };
};
const strike = (amount: number) =>
  actionEvent(
    `strike-${amount}`,
    [
      { kind: "chooseTarget", slot: "m", chooser: { kind: "controller" }, query: { categories: ["minion"] } },
      { kind: "attack", target: { kind: "slot", slot: "m" }, amount: n(amount), overkill: true, bind: "hit" },
      {
        kind: "addCounters",
        target: recorder,
        counterType: "excess",
        amount: { kind: "var", name: "hit.excessDealt" },
      },
    ],
    "attack",
  );
const STRIKE_2 = strike(2);
const STRIKE_4 = strike(4);
const STRIKE_5 = strike(5);
const ZAP_2 = actionEvent("zap-2", [{ kind: "dealDamage", target: eachMinion, amount: n(2) }]);
const ZAP_3 = actionEvent("zap-3", [{ kind: "dealDamage", target: eachMinion, amount: n(3) }]);
const PLACE_4 = actionEvent("place-4", [{ kind: "placeDamage", target: eachMinion, amount: n(4) }]);
const TOUGHEN = actionEvent("toughen", [{ kind: "giveStatus", target: eachMinion, status: "tough" }]);
const DISMISS = actionEvent("dismiss", [{ kind: "discardFromPlay", target: eachMinion }]);
const EVENTS = [STRIKE_2, STRIKE_4, STRIKE_5, ZAP_2, ZAP_3, PLACE_4, TOUGHEN, DISMISS];

const deps: EngineDeps = depsOf(
  NIMROD_RULE,
  PER_ATTACK_RULE,
  SUSTAINED_RULE,
  TURRET_RULE,
  ...EVENTS.map((e) => e.ability),
);
const CARDS = [NIMROD, FRAIL, BOTH, SUSTAINED, VILLAIN, RECORDER, TURRET, ...EVENTS.map((e) => e.card)];

/** p1's first turn, in hero form, with `minion` engaged and nothing on it; returns its instance id. */
function start(
  minion: CardId = NIMROD.id,
  withSustained = false,
): { readonly state: GameState; readonly minionId: InstanceId } {
  const base = gameAtFirstTurn({
    cards: CARDS,
    deps,
    villain: VILLAIN,
    deck: [RECORDER.id, TURRET.id, ...EVENTS.flatMap((e) => copiesOf(e.card.id, 3))],
    // Blank treacheries otherwise, so a villain phase's encounter card adds no rule of its own.
    encounter: [minion, ...(withSustained ? [SUSTAINED.id] : []), ...copiesOf(TREACHERY.id, 20)],
  });
  const hero: GameState = {
    ...base,
    players: base.players.map((p) => ({ ...p, identity: { ...p.identity, form: "hero" } })),
  };
  const engaged = minionEngagedWith(hero, minion);
  return { state: engaged.state, minionId: engaged.id };
}
/** Test surgery before a session starts, so the next session's replay reproduces it. */
const withMinion = (state: GameState, id: InstanceId, patch: Partial<CardInstance>): GameState => ({
  ...state,
  instances: { ...state.instances, [id]: { ...mustInstance(state, id), ...patch } },
});
const capped = (events: readonly GameEvent[]) => events.filter((e) => e.type === "damageCapped");
const dealt = (events: readonly GameEvent[], id: InstanceId) =>
  events.filter((e) => e.type === "damageDealt" && e.targetInstanceId === id);
const prevented = (events: readonly GameEvent[]) => events.filter((e) => e.type === "damagePrevented");
function expectReplays(result: ReturnType<typeof playFree>): void {
  const replayed = replay(result.session.log, deps);
  if (!replayed.ok) throw new Error(replayed.error.message);
  expect(replayed.state).toEqual(result.state);
}

describe("§3.4 a per-phase cap: 'Nimrod cannot take more than 3 damage each phase'", () => {
  it("within one phase, damage past 3 is not taken across several damage events; the rest is capped, not prevented", () => {
    const { state, minionId } = start();
    const zapped = playFree(state, deps, ZAP_2.card.id);
    expect(mustInstance(zapped.state, minionId)).toMatchObject({ damage: 2, damageTakenThisPhase: 2 });
    expect(capped(zapped.events)).toEqual([]);

    const struck = playFree(zapped.state, deps, STRIKE_2.card.id);
    expect(mustInstance(struck.state, minionId)).toMatchObject({ damage: 3, damageTakenThisPhase: 3 });
    expect(dealt(struck.events, minionId)).toEqual([
      { type: "damageDealt", targetInstanceId: minionId, amount: 1, sourceInstanceId: expect.anything() },
    ]);
    expect(capped(struck.events)).toEqual([{ type: "damageCapped", targetInstanceId: minionId, amount: 1 }]);
    expect(prevented(struck.events)).toEqual([]);

    const again = playFree(struck.state, deps, STRIKE_2.card.id);
    expect(mustInstance(again.state, minionId)).toMatchObject({ damage: 3, damageTakenThisPhase: 3 });
    expect(dealt(again.events, minionId)).toEqual([]);
    expect(capped(again.events)).toEqual([{ type: "damageCapped", targetInstanceId: minionId, amount: 2 }]);
    expect(prevented(again.events)).toEqual([]);
    expectReplays(again);
  });

  it("the tally starts over each phase: the villain phase allows 3 more, and the next player phase 3 more again", () => {
    const { state, minionId } = start();
    const turret = playerCardIntoPlay(withMinion(state, minionId, { damage: 3, damageTakenThisPhase: 3 }), TURRET.id);
    const endTurn: Command = { type: "endTurn", playerId: P1 };
    // The turret's 5 damage lands as the villain phase begins: 3 taken (a fresh tally), 2 capped.
    const round = playFree(turret.state, deps, ZAP_2.card.id, P1, [endTurn]);
    const villainPhase = dealt(round.events, minionId);
    expect(villainPhase.map((e) => (e.type === "damageDealt" ? e.amount : 0))).toEqual([3]);
    // The ZAP_2 at a full tally is all capped; then the turret's 5 is capped by 2.
    expect(capped(round.events)).toEqual([
      { type: "damageCapped", targetInstanceId: minionId, amount: 2 },
      { type: "damageCapped", targetInstanceId: minionId, amount: 2 },
    ]);
    expect(round.state.round).toBe(2);
    expect(round.state.step).toMatchObject({ phase: "player", kind: "turn" });
    // 3 before, 0 of the ZAP_2 (player phase already at 3, so capped 2), 3 in the villain phase; the new player phase
    // starts with no tally at all.
    const after = mustInstance(round.state, minionId);
    expect(after.damage).toBe(6);
    expect("damageTakenThisPhase" in after).toBe(false);
    expectReplays(round);

    const nextPhase = playFree(round.state, deps, ZAP_3.card.id);
    expect(mustInstance(nextPhase.state, minionId)).toMatchObject({ damage: 9, damageTakenThisPhase: 3 });
    expect(capped(nextPhase.events)).toEqual([]);
  });

  it("at the cap a tough status card is kept; under it, tough prevents only what would be taken and the tally holds", () => {
    const { state, minionId } = start();
    const atCap = playFree(
      withMinion(state, minionId, { damageTakenThisPhase: 3, statuses: { stunned: 0, confused: 0, tough: 1 } }),
      deps,
      STRIKE_4.card.id,
    );
    expect(mustInstance(atCap.state, minionId)).toMatchObject({
      damage: 0,
      damageTakenThisPhase: 3,
      statuses: { tough: 1 },
    });
    expect(capped(atCap.events)).toEqual([{ type: "damageCapped", targetInstanceId: minionId, amount: 4 }]);
    expect(prevented(atCap.events)).toEqual([]);
    expectReplays(atCap);

    const toughened = playFree(withMinion(state, minionId, { damageTakenThisPhase: 2 }), deps, TOUGHEN.card.id).state;
    const under = playFree(toughened, deps, STRIKE_4.card.id);
    expect(mustInstance(under.state, minionId)).toMatchObject({
      damage: 0,
      damageTakenThisPhase: 2,
      statuses: { tough: 0 },
    });
    expect(capped(under.events)).toEqual([{ type: "damageCapped", targetInstanceId: minionId, amount: 3 }]);
    expect(prevented(under.events)).toEqual([
      { type: "damagePrevented", targetInstanceId: minionId, amount: 1, reason: "tough" },
    ]);
  });

  it("with §3.3's sustained-damage cap the lower allowance wins, in one damageCapped", () => {
    const { state, minionId } = start(NIMROD.id, true);
    // 3 sustained, cap 4: 1 more allowed; the phase allows 3. A 3-damage event takes 1.
    const schemed = encounterCardInVillainArea(withMinion(state, minionId, { damage: 3 }), SUSTAINED.id, 3).state;
    const result = playFree(schemed, deps, ZAP_3.card.id);
    expect(mustInstance(result.state, minionId)).toMatchObject({ damage: 4, damageTakenThisPhase: 1 });
    expect(capped(result.events)).toEqual([{ type: "damageCapped", targetInstanceId: minionId, amount: 2 }]);
    expectReplays(result);
  });

  it("beside a per-attack cap: that one reduces (prevented, 'reduced'), then the phase cap holds back the rest", () => {
    const { state, minionId } = start(BOTH.id);
    const first = playFree(state, deps, STRIKE_5.card.id);
    expect(mustInstance(first.state, minionId)).toMatchObject({ damage: 2, damageTakenThisPhase: 2 });
    expect(prevented(first.events)).toEqual([
      { type: "damagePrevented", targetInstanceId: minionId, amount: 3, reason: "reduced" },
    ]);
    expect(capped(first.events)).toEqual([]);
    const second = playFree(first.state, deps, STRIKE_5.card.id);
    expect(mustInstance(second.state, minionId)).toMatchObject({ damage: 3, damageTakenThisPhase: 3 });
    expect(prevented(second.events)).toEqual([
      { type: "damagePrevented", targetInstanceId: minionId, amount: 3, reason: "reduced" },
    ]);
    expect(capped(second.events)).toEqual([{ type: "damageCapped", targetInstanceId: minionId, amount: 1 }]);
    expectReplays(second);
  });

  it("capped damage gives no excess and no overkill: a defeat by exactly the damage taken spills nothing", () => {
    // 4 hit points, 2 damage, 1 taken this phase: a 5-damage overkill attack makes it take 2, exactly its remaining 2.
    const { state, minionId } = start(FRAIL.id);
    const withRecorder = playerCardIntoPlay(
      withMinion(state, minionId, { damage: 2, damageTakenThisPhase: 1 }),
      RECORDER.id,
    );
    const result = playFree(withRecorder.state, deps, STRIKE_5.card.id);
    expect(dealt(result.events, minionId)).toEqual([
      { type: "damageDealt", targetInstanceId: minionId, amount: 2, sourceInstanceId: expect.anything() },
    ]);
    expect(capped(result.events)).toEqual([{ type: "damageCapped", targetInstanceId: minionId, amount: 3 }]);
    expect(result.events).toContainEqual(expect.objectContaining({ type: "characterDefeated", instanceId: minionId }));
    expect(result.events.some((e) => e.type === "overkillSpilled")).toBe(false);
    expect(mustInstance(result.state, result.state.villains[0]!.instanceId).damage).toBe(0);
    expect(mustInstance(result.state, withRecorder.id).counters.excess ?? 0).toBe(0);
    // Out of play, the tally is gone with the rest of its state.
    expect("damageTakenThisPhase" in mustInstance(result.state, minionId)).toBe(false);
    expectReplays(result);
  });

  it("placed damage is not damage taken: it is neither counted nor held back", () => {
    const { state, minionId } = start();
    const result = playFree(withMinion(state, minionId, { damageTakenThisPhase: 3 }), deps, PLACE_4.card.id);
    expect(mustInstance(result.state, minionId)).toMatchObject({ damage: 4, damageTakenThisPhase: 3 });
    expect(capped(result.events)).toEqual([]);
  });

  it("leaving play drops the tally: a card that comes back is a new instance", () => {
    const { state, minionId } = start();
    const result = playFree(withMinion(state, minionId, { damageTakenThisPhase: 3 }), deps, DISMISS.card.id);
    expect("damageTakenThisPhase" in mustInstance(result.state, minionId)).toBe(false);
    expectReplays(result);
  });
});
