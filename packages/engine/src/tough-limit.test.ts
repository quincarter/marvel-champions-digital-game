/**
 * docs/phase7-wave6.md §3.7: a numeric tough status capacity (`RuleSpec statusLimit.max` a number). Synthetic steady
 * minion shaped like Colossus (`mut_gen` 32001a: "Colossus can have 1 additional tough status card."), and side schemes
 * granting the same rule so it can end.
 *
 * Sources: RRG 1.8 "Status Cards" (p. 41: one of each type, unless a card says otherwise), "Tough" (a tough card
 * prevents all the damage of one event and is discarded), "Piercing" (tough status cards are discarded before damage),
 * "Steady" (p. 41: two stunned / two confused; it says nothing of tough).
 */

import type { CardId } from "@mc/content";
import { describe, expect, it } from "vitest";
import type { AbilityDefinition, RuleSpec } from "./abilities.js";
import { replay, startSession } from "./engine.js";
import type { GameEvent } from "./events.js";
import type { InstanceId } from "./ids.js";
import { statusCapacity } from "./keywords.js";
import { mustInstance } from "./query.js";
import type { EffectSpec, TargetQuery, TargetRef } from "./spec.js";
import type { GameState } from "./state.js";
import { depsOf, stubAbility } from "./testing/abilities.js";
import { driveSession } from "./testing/drive.js";
import { stubEvent, stubMinion, stubSideScheme } from "./testing/fixtures.js";
import { giveCard } from "./testing/scenario.js";
import { encounterCardInVillainArea, gameAtFirstTurn, minionEngagedWith, P1 } from "./testing/wave3.js";

const def = (definition: AbilityDefinition) => definition;
const n = (value: number) => ({ kind: "const", value }) as const;
const limit = (max: number | "unlimited", target: TargetQuery): RuleSpec => ({
  kind: "statusLimit",
  target,
  status: "tough",
  max,
});

/** Colossus's shape: steady, and "can have 1 additional tough status card" (a total of 2). */
const COLOSSUS_CONSTANT = stubAbility(
  "colossus.constant",
  def({ trigger: { kind: "constant", rules: [limit(2, { self: true })] }, effects: [] }),
);
const COLOSSUS = stubMinion({
  id: "colossus",
  atk: 1,
  sch: 1,
  hp: 20,
  boostIcons: 0,
  keywords: [{ name: "steady" }],
  abilities: [COLOSSUS_CONSTANT.ref],
});
/** A steady minion with no rule of its own. */
const BRUTE = stubMinion({ id: "brute", atk: 1, sch: 1, hp: 20, boostIcons: 0, keywords: [{ name: "steady" }] });

const ruleScheme = (id: string, max: number | "unlimited") => {
  const ability = stubAbility(
    `${id}.constant`,
    def({ trigger: { kind: "constant", rules: [limit(max, { categories: ["minion"] })] }, effects: [] }),
  );
  return { ability, card: stubSideScheme({ id, startingThreat: 5, abilities: [ability.ref] }) };
};
/** "Each minion can have 1 additional tough status card." */
const PLATING = ruleScheme("plating", 2);
/** "Each minion can have 2 additional tough status cards." */
const FORTRESS = ruleScheme("fortress", 3);

const named = (name: string): TargetRef => ({ kind: "named", name });
const eventOf = (id: string, effects: readonly EffectSpec[]) => {
  const ability = stubAbility(`${id}.action`, def({ trigger: { kind: "action" }, effects }));
  return { ability, card: stubEvent({ id, cost: 0, abilities: [ability.ref] }), id: id as CardId };
};
const toughen = (target: string) =>
  eventOf(`toughen-${target}`, [{ kind: "giveStatus", target: named(target), status: "tough" }]);
const stun = (target: string) =>
  eventOf(`stun-${target}`, [{ kind: "giveStatus", target: named(target), status: "stunned" }]);
const zap = (target: string) => eventOf(`zap-${target}`, [{ kind: "dealDamage", target: named(target), amount: n(2) }]);
const TOUGHEN = toughen("colossus");
const TOUGHEN_BRUTE = toughen("brute");
const STUN = stun("colossus");
const STUN_BRUTE = stun("brute");
const ZAP = zap("colossus");
const PIERCE = eventOf("pierce", [{ kind: "attack", target: named("colossus"), amount: n(2), keywords: ["piercing"] }]);
const CLEAR_PLATING = eventOf("clear-plating", [{ kind: "removeThreat", target: named("plating"), amount: n(5) }]);
const EVENTS = [TOUGHEN, TOUGHEN_BRUTE, STUN, STUN_BRUTE, ZAP, PIERCE, CLEAR_PLATING];

const deps = depsOf(COLOSSUS_CONSTANT, PLATING.ability, FORTRESS.ability, ...EVENTS.map((e) => e.ability));

/** Colossus and Brute engaged with P1, and the rule schemes `rules` in the villain's area. */
function start(...rules: readonly CardId[]) {
  let state = gameAtFirstTurn({
    cards: [COLOSSUS, BRUTE, PLATING.card, FORTRESS.card, ...EVENTS.map((e) => e.card)],
    deps,
    deck: EVENTS.flatMap((e) => times(e.id, 4)),
    encounter: [COLOSSUS.id, BRUTE.id, PLATING.card.id, FORTRESS.card.id],
  });
  for (const rule of rules) state = encounterCardInVillainArea(state, rule, 5).state;
  const colossus = minionEngagedWith(state, COLOSSUS.id);
  const brute = minionEngagedWith(colossus.state, BRUTE.id);
  return { state: brute.state, colossus: colossus.id, brute: brute.id };
}

/** Plays each card for 0 in turn, each through a fresh session whose log replays to the same state. */
function play(state: GameState, ...cards: readonly CardId[]) {
  let s = state;
  const events: GameEvent[] = [];
  for (const card of cards) {
    const given = giveCard(s, P1, card);
    const driven = driveSession(startSession(given.state), deps, [
      { type: "playCard", playerId: P1, cardInstanceId: given.id, payment: [], attachToInstanceId: null },
    ]);
    const replayed = replay(driven.session.log, deps);
    if (!replayed.ok) throw new Error(replayed.error.message);
    expect(replayed.state).toEqual(driven.session.state);
    s = driven.session.state;
    events.push(...driven.events);
  }
  return { state: s, events };
}
const statuses = (state: GameState, id: InstanceId) => mustInstance(state, id).statuses;
const times = (card: CardId, count: number): CardId[] => Array.from({ length: count }, () => card);

describe("§3.7 a numeric tough status capacity", () => {
  it("Colossus holds two tough; a third is refused", () => {
    const game = start();
    expect(statusCapacity(game.state, game.colossus, "tough", deps)).toBe(2);
    const { state, events } = play(game.state, ...times(TOUGHEN.id, 3));
    expect(statuses(state, game.colossus)).toEqual({ stunned: 0, confused: 0, tough: 2 });
    expect(events.filter((e) => e.type === "statusGiven")).toEqual([
      { type: "statusGiven", instanceId: game.colossus, status: "tough" },
      { type: "statusGiven", instanceId: game.colossus, status: "tough" },
    ]);
  });

  it("each tough card prevents one damage event and is discarded alone", () => {
    const game = start();
    const tough = play(game.state, ...times(TOUGHEN.id, 2)).state;
    const once = play(tough, ZAP.id).state;
    expect(statuses(once, game.colossus).tough).toBe(1);
    expect(mustInstance(once, game.colossus).damage).toBe(0);
    const thrice = play(once, ZAP.id, ZAP.id).state;
    expect(statuses(thrice, game.colossus).tough).toBe(0);
    expect(mustInstance(thrice, game.colossus).damage).toBe(2);
  });

  it("piercing discards them all", () => {
    const game = start();
    const tough = play(game.state, ...times(TOUGHEN.id, 2)).state;
    const { state, events } = play(tough, PIERCE.id);
    expect(statuses(state, game.colossus).tough).toBe(0);
    expect(mustInstance(state, game.colossus).damage).toBe(2);
    expect(events.filter((e) => e.type === "statusRemoved")).toEqual([
      { type: "statusRemoved", instanceId: game.colossus, status: "tough", reason: "piercing" },
    ]);
  });

  it("steady's stun capacity is unchanged, and steady alone gives no extra tough", () => {
    const game = start();
    const { state } = play(game.state, ...times(STUN.id, 3), ...times(STUN_BRUTE.id, 3), ...times(TOUGHEN_BRUTE.id, 2));
    expect(statuses(state, game.colossus)).toEqual({ stunned: 2, confused: 0, tough: 0 });
    expect(statuses(state, game.brute)).toEqual({ stunned: 2, confused: 0, tough: 1 });
  });

  it("with several rules the largest wins, whatever the order", () => {
    for (const order of [
      [PLATING.card.id, FORTRESS.card.id],
      [FORTRESS.card.id, PLATING.card.id],
    ]) {
      const game = start(...order);
      expect(statusCapacity(game.state, game.colossus, "tough", deps)).toBe(3);
      expect(statusCapacity(game.state, game.brute, "tough", deps)).toBe(3);
    }
    const plated = start(PLATING.card.id);
    expect(statusCapacity(plated.state, plated.colossus, "tough", deps)).toBe(2);
    expect(statusCapacity(plated.state, plated.brute, "tough", deps)).toBe(2);
  });

  it("with the rule gone the extra card is trimmed by the state check", () => {
    const game = start(PLATING.card.id);
    const tough = play(game.state, ...times(TOUGHEN_BRUTE.id, 3), ...times(TOUGHEN.id, 2)).state;
    expect(statuses(tough, game.brute).tough).toBe(2);
    const { state, events } = play(tough, CLEAR_PLATING.id);
    expect(state.villainArea.some((id) => mustInstance(state, id).cardId === PLATING.card.id)).toBe(false);
    expect(statuses(state, game.brute).tough).toBe(1);
    // Colossus's own rule still holds two.
    expect(statuses(state, game.colossus).tough).toBe(2);
    expect(events.filter((e) => e.type === "statusRemoved")).toEqual([
      { type: "statusRemoved", instanceId: game.brute, status: "tough", reason: "cannotHave" },
    ]);
  });
});
