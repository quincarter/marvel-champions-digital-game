/**
 * docs/phase7-wave6.md §3.3: "Magneto cannot have more than 6[per_hero] sustained damage." (Boarding Party, Sabotage
 * Master Mold, Orbital Decay), as `RuleSpec maxSustainedDamage` on a synthetic side scheme.
 *
 * Sources: RRG 1.8 "Sustained Damage" (p. 42): maximum minus remaining hit points. §4.1 Q9: damage beyond the cap is
 * neither taken nor prevented (no `damagePrevented`, no tough card for it), and "excess damage" readers still count it
 * as dealt (ruling Jan 26, 2026 (3)).
 */

import { flat, type CardId } from "@mc/content";
import { describe, expect, it } from "vitest";
import type { AbilityDefinition, EngineDeps } from "./abilities.js";
import { replay } from "./engine.js";
import type { GameEvent } from "./events.js";
import type { InstanceId } from "./ids.js";
import { mustInstance } from "./query.js";
import type { EffectSpec, TargetRef } from "./spec.js";
import type { GameState } from "./state.js";
import { depsOf, stubAbility } from "./testing/abilities.js";
import { stubEvent, stubSideScheme, stubSupport, stubVillain } from "./testing/fixtures.js";
import {
  copiesOf,
  encounterCardInVillainArea,
  gameAtFirstTurn,
  playerCardIntoPlay,
  playFree,
} from "./testing/wave3.js";

const n = (value: number) => ({ kind: "const", value }) as const;
const theVillain: TargetRef = { kind: "villain" };
const sideSchemes: TargetRef = { kind: "each", query: { categories: ["sideScheme"] } };
const recorder: TargetRef = { kind: "each", query: { categories: ["support"], name: "recorder" } };

/** "Magneto cannot have more than 6[per_hero] sustained damage." */
const CAP_RULE = stubAbility("boarding.constant", {
  trigger: {
    kind: "constant",
    rules: [
      {
        kind: "maxSustainedDamage",
        target: { categories: ["villain"] },
        amount: { kind: "perPlayer", base: 0, perPlayer: 6 },
      },
    ],
  },
  effects: [],
} satisfies AbilityDefinition);
/** Orbital Decay's shape, a second cap in play: 18[per_hero]. The lowest wins. */
const WIDE_CAP_RULE = stubAbility("orbital.constant", {
  trigger: {
    kind: "constant",
    rules: [
      {
        kind: "maxSustainedDamage",
        target: { categories: ["villain"] },
        amount: { kind: "perPlayer", base: 0, perPlayer: 18 },
      },
    ],
  },
  effects: [],
} satisfies AbilityDefinition);
const BOARDING = stubSideScheme({ id: "boarding", startingThreat: 3, abilities: [CAP_RULE.ref] });
const ORBITAL = stubSideScheme({ id: "orbital", startingThreat: 3, abilities: [WIDE_CAP_RULE.ref] });
const MAGNETO = stubVillain({ id: "magneto", stages: [{ hp: flat(10), atk: 1, sch: 1 }] });
const RECORDER = stubSupport({ id: "recorder", cost: 0 });

const actionEvent = (id: string, effects: readonly EffectSpec[], label?: "attack") => {
  const ability = stubAbility(`${id}.action`, {
    trigger: { kind: "action" },
    ...(label ? { label: [label] } : {}),
    effects,
  });
  return { card: stubEvent({ id, cost: 0, abilities: [ability.ref] }), ability };
};
const recordExcess: EffectSpec = {
  kind: "addCounters",
  target: recorder,
  counterType: "excess",
  amount: { kind: "var", name: "hit.excessDealt" },
};
const strike = (amount: number) =>
  actionEvent(
    `strike-${amount}`,
    [{ kind: "attack", target: theVillain, amount: n(amount), overkill: true, bind: "hit" }, recordExcess],
    "attack",
  );
const STRIKE_4 = strike(4);
const STRIKE_15 = strike(15);
const ZAP_4 = actionEvent("zap-4", [{ kind: "dealDamage", target: theVillain, amount: n(4) }]);
const PLACE_4 = actionEvent("place-4", [{ kind: "placeDamage", target: theVillain, amount: n(4) }]);
const TOUGHEN = actionEvent("toughen", [{ kind: "giveStatus", target: theVillain, status: "tough" }]);
const HEAL_3 = actionEvent("heal-3", [{ kind: "heal", target: theVillain, amount: n(3) }]);
const CLEAR = actionEvent("clear", [{ kind: "removeThreat", target: sideSchemes, amount: n(3) }]);
const EVENTS = [STRIKE_4, STRIKE_15, ZAP_4, PLACE_4, TOUGHEN, HEAL_3, CLEAR];

const deps: EngineDeps = depsOf(CAP_RULE, WIDE_CAP_RULE, ...EVENTS.map((e) => e.ability));
const CARDS = [MAGNETO, BOARDING, ORBITAL, RECORDER, ...EVENTS.map((e) => e.card)];

function start(schemes: readonly CardId[], players: 1 | 2 = 1): GameState {
  const base = gameAtFirstTurn({
    cards: CARDS,
    deps,
    villain: MAGNETO,
    players,
    deck: [RECORDER.id, ...EVENTS.flatMap((e) => copiesOf(e.card.id, 2))],
    encounter: [BOARDING.id, ORBITAL.id],
  });
  let state: GameState = {
    ...base,
    players: base.players.map((p) => ({ ...p, identity: { ...p.identity, form: "hero" } })),
  };
  for (const scheme of schemes) state = encounterCardInVillainArea(state, scheme, 3).state;
  return state;
}
const villainId = (state: GameState): InstanceId => state.villains[0]!.instanceId;
const villainDamage = (state: GameState): number => mustInstance(state, villainId(state)).damage;
const withDamage = (state: GameState, damage: number): GameState => ({
  ...state,
  instances: { ...state.instances, [villainId(state)]: { ...mustInstance(state, villainId(state)), damage } },
});
const capped = (events: readonly GameEvent[]) => events.filter((e) => e.type === "damageCapped");
const prevented = (events: readonly GameEvent[]) =>
  events.filter(
    (e) => e.type === "damagePrevented" || (e.type === "triggerEvent" && e.event.kind === "damagePrevented"),
  );
function expectReplays(result: ReturnType<typeof playFree>): void {
  const replayed = replay(result.session.log, deps);
  if (!replayed.ok) throw new Error(replayed.error.message);
  expect(replayed.state).toEqual(result.state);
}

describe("§3.3 maxSustainedDamage: 'Magneto cannot have more than 6[per_hero] sustained damage'", () => {
  it("damage over the cap is capped exactly: 4 at 4 sustained takes 2, and the rest is logged as capped", () => {
    const result = playFree(withDamage(start([BOARDING.id]), 4), deps, ZAP_4.card.id);
    expect(villainDamage(result.state)).toBe(6);
    expect(capped(result.events)).toEqual([
      { type: "damageCapped", targetInstanceId: villainId(result.state), amount: 2 },
    ]);
    expect(result.events).toContainEqual(expect.objectContaining({ type: "damageDealt", amount: 2 }));
    expectReplays(result);
  });

  it("at the cap nothing more is taken, and an attack's damage is capped the same way", () => {
    const atCap = playFree(withDamage(start([BOARDING.id]), 6), deps, STRIKE_4.card.id);
    expect(villainDamage(atCap.state)).toBe(6);
    expect(capped(atCap.events)).toEqual([
      { type: "damageCapped", targetInstanceId: villainId(atCap.state), amount: 4 },
    ]);
    expect(atCap.events.some((e) => e.type === "damageDealt")).toBe(false);
    expectReplays(atCap);
  });

  it("[per_hero] is read live: two players cap it at 12", () => {
    const result = playFree(withDamage(start([BOARDING.id], 2), 10), deps, ZAP_4.card.id);
    expect(villainDamage(result.state)).toBe(12);
  });

  it("several caps: the lowest wins", () => {
    const result = playFree(withDamage(start([ORBITAL.id, BOARDING.id]), 4), deps, ZAP_4.card.id);
    expect(villainDamage(result.state)).toBe(6);
  });

  it("the excess is not prevented: no damagePrevented is logged or announced", () => {
    const result = playFree(withDamage(start([BOARDING.id]), 5), deps, STRIKE_4.card.id);
    expect(villainDamage(result.state)).toBe(6);
    expect(prevented(result.events)).toEqual([]);
  });

  it("at the cap a tough status card is kept: nothing would be taken for it to prevent", () => {
    const tough = playFree(withDamage(start([BOARDING.id]), 6), deps, TOUGHEN.card.id).state;
    const result = playFree(tough, deps, STRIKE_4.card.id);
    expect(mustInstance(result.state, villainId(result.state)).statuses.tough).toBe(1);
    expect(villainDamage(result.state)).toBe(6);
    expect(prevented(result.events)).toEqual([]);
    expectReplays(result);
  });

  it("under the cap a tough card prevents only what would be taken; the rest is capped, not prevented", () => {
    const tough = playFree(withDamage(start([BOARDING.id]), 4), deps, TOUGHEN.card.id).state;
    const result = playFree(tough, deps, STRIKE_4.card.id);
    expect(mustInstance(result.state, villainId(result.state)).statuses.tough).toBe(0);
    expect(villainDamage(result.state)).toBe(4);
    expect(capped(result.events)).toEqual([
      { type: "damageCapped", targetInstanceId: villainId(result.state), amount: 2 },
    ]);
    expect(result.events.filter((e) => e.type === "damagePrevented")).toEqual([
      { type: "damagePrevented", targetInstanceId: villainId(result.state), amount: 2, reason: "tough" },
    ]);
  });

  it("an excess-damage reader still sees the damage dealt beyond remaining hit points (Q9)", () => {
    // 10 hit points, 0 sustained, cap 6: an attack for 15 makes Magneto take 6, and deals 15 − 10 = 5 excess.
    const withRecorder = playerCardIntoPlay(start([BOARDING.id]), RECORDER.id);
    const result = playFree(withRecorder.state, deps, STRIKE_15.card.id);
    expect(villainDamage(result.state)).toBe(6);
    expect(result.state.villains[0]).toMatchObject({ stageIndex: 0, defeated: false });
    expect(mustInstance(result.state, withRecorder.id).counters.excess).toBe(5);
    expect(capped(result.events)).toEqual([
      { type: "damageCapped", targetInstanceId: villainId(result.state), amount: 9 },
    ]);
    expectReplays(result);
  });

  it("placed damage is held to the cap too", () => {
    const result = playFree(withDamage(start([BOARDING.id]), 4), deps, PLACE_4.card.id);
    expect(villainDamage(result.state)).toBe(6);
    expect(result.events).toContainEqual({
      type: "damagePlaced",
      targetInstanceId: villainId(result.state),
      amount: 2,
      sourceInstanceId: expect.anything(),
    });
    expect(capped(result.events)).toEqual([
      { type: "damageCapped", targetInstanceId: villainId(result.state), amount: 2 },
    ]);
  });

  it("the cap does not stop healing, and does not heal a villain already above it", () => {
    const above = start([BOARDING.id]);
    expect(villainDamage(playFree(withDamage(above, 8), deps, ZAP_4.card.id).state)).toBe(8);
    expect(villainDamage(playFree(withDamage(above, 6), deps, HEAL_3.card.id).state)).toBe(3);
  });

  it("the cap ends when its side scheme leaves play", () => {
    const cleared = playFree(withDamage(start([BOARDING.id]), 4), deps, CLEAR.card.id);
    expect(cleared.state.villainArea.some((id) => mustInstance(cleared.state, id).cardId === BOARDING.id)).toBe(false);
    const result = playFree(cleared.state, deps, ZAP_4.card.id);
    expect(villainDamage(result.state)).toBe(8);
    expect(capped(result.events)).toEqual([]);
  });

  it("an uncapped villain is unchanged", () => {
    const result = playFree(withDamage(start([]), 4), deps, ZAP_4.card.id);
    expect(villainDamage(result.state)).toBe(8);
    expect(capped(result.events)).toEqual([]);
    expectReplays(result);
  });
});
