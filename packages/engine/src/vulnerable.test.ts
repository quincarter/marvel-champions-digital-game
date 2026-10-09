/**
 * docs/phase7-wave9.md §3.1: the vulnerable keyword. RRG 1.8 "Vulnerable" (p. 48): "When a character with vulnerable
 * becomes confused or stunned, that character is immediately discarded (without being defeated)." "If a character with
 * the vulnerable keyword would simultaneously take enough damage to defeat it and become either confused or stunned, it
 * is discarded before the damage is applied and is not considered defeated." "If a character has both the steady and
 * vulnerable keywords, the vulnerable keyword does not take effect until that character has two confused or two
 * stunned status cards." MC50 rulebook p. 3 says the same.
 */

import type { CardId, KeywordInstance } from "@mc/content";
import { describe, expect, it } from "vitest";
import type { EngineDeps } from "./abilities.js";
import type { GameEvent } from "./events.js";
import type { InstanceId } from "./ids.js";
import { activeEncounterDeck, mustInstance } from "./query.js";
import type { EffectSpec, TargetRef } from "./spec.js";
import type { GameState } from "./state.js";
import { depsOf, stubAbility } from "./testing/abilities.js";
import { stubEvent, stubMinion, stubTreachery } from "./testing/fixtures.js";
import { copiesOf, gameAtFirstTurn, minionEngagedWith, playFree } from "./testing/wave3.js";

const n = (value: number) => ({ kind: "const", value }) as const;
const theMinion: TargetRef = { kind: "each", query: { categories: ["minion"] } };
const VULNERABLE: KeywordInstance = { name: "vulnerable" };

/** "When Defeated: Place 1 threat on the main scheme." It must not resolve for a discard. */
const PLACES_THREAT = stubAbility("vul.when-defeated", {
  trigger: { kind: "whenDefeated" },
  effects: [{ kind: "placeThreat", target: { kind: "mainScheme" }, amount: n(1) }],
});
/** A constant that gives its own card the keyword, so it is gained, not printed. */
const GAINS_VULNERABLE = stubAbility("vul.gains", {
  trigger: { kind: "constant", keywordGrants: [{ keyword: VULNERABLE, target: { self: true } }] },
  effects: [],
});

const minion = (id: string, hp: number, keywords: readonly KeywordInstance[], gained = false) =>
  stubMinion({
    id,
    atk: 1,
    sch: 1,
    hp,
    boostIcons: 0,
    keywords,
    abilities: [PLACES_THREAT.ref, ...(gained ? [GAINS_VULNERABLE.ref] : [])],
  });
const GUARD = minion("vul-guard", 3, [VULNERABLE]);
const SUPREME = minion("vul-supreme", 4, [VULNERABLE, { name: "victory", value: 1 }]);
const VETERAN = minion("vul-veteran", 3, [VULNERABLE, { name: "steady" }]);
const ZEALOT = minion("vul-zealot", 3, [VULNERABLE, { name: "stalwart" }]);
const BRUISER = minion("vul-bruiser", 3, [VULNERABLE, { name: "toughness" }]);
const FIXTURE = minion("vul-fixture", 3, [VULNERABLE, { name: "permanent" }]);
const RECRUIT = minion("vul-recruit", 3, [], true);
const THUG = minion("vul-thug", 3, []);
const MINIONS = [GUARD, SUPREME, VETERAN, ZEALOT, BRUISER, FIXTURE, RECRUIT, THUG];
const BLANK = stubTreachery({ id: "vul-blank", boostIcons: 0 });

const actionEvent = (id: string, effects: readonly EffectSpec[]) => {
  const ability = stubAbility(`${id}.action`, { trigger: { kind: "action" }, effects });
  return { card: stubEvent({ id, cost: 0, abilities: [ability.ref] }), ability };
};
const stun: EffectSpec = { kind: "giveStatus", target: theMinion, status: "stunned" };
const confuse: EffectSpec = { kind: "giveStatus", target: theMinion, status: "confused" };
const damage = (amount: number): EffectSpec => ({ kind: "dealDamage", target: theMinion, amount: n(amount) });
const STUN = actionEvent("vul-stun", [stun]);
const CONFUSE = actionEvent("vul-confuse", [confuse]);
/** "Confuse that minion and deal 2 damage to it" (Prism Dust's wording), written in each order. */
const CONFUSE_AND_DAMAGE = actionEvent("vul-confuse-and-damage", [confuse, damage(2)]);
const DAMAGE_AND_CONFUSE = actionEvent("vul-damage-and-confuse", [damage(2), confuse]);
/** "Deal 3 damage to that minion. Then, stun it.": the damage resolves first (RRG 1.8 "'Then'", p. 44). */
const DAMAGE_THEN_STUN = actionEvent("vul-damage-then-stun", [damage(3), { kind: "then", effects: [stun] }]);
/** An attack that deals 3 damage with overkill and stuns. */
const OVERKILL_AND_STUN = actionEvent("vul-overkill-and-stun", [
  { kind: "attack", target: theMinion, amount: n(3), overkill: true },
  stun,
]);
const EVENTS = [STUN, CONFUSE, CONFUSE_AND_DAMAGE, DAMAGE_AND_CONFUSE, DAMAGE_THEN_STUN, OVERKILL_AND_STUN];

const deps: EngineDeps = depsOf(PLACES_THREAT, GAINS_VULNERABLE, ...EVENTS.map((e) => e.ability));
const CARDS = [...MINIONS, BLANK, ...EVENTS.map((e) => e.card)];
const ENCOUNTER: readonly CardId[] = [...MINIONS.map((card) => card.id), ...copiesOf(BLANK.id, 20)];

/** A game at the first turn with one copy of `card` engaged with player 1, holding `damageOn` damage. */
function withMinion(card: { readonly id: CardId }, damageOn = 0): { state: GameState; id: InstanceId } {
  const deck = EVENTS.flatMap((event) => copiesOf(event.card.id, 2));
  const start = gameAtFirstTurn({ cards: CARDS, deps, encounter: ENCOUNTER, deck });
  const engaged = minionEngagedWith(start, card.id);
  const instance = mustInstance(engaged.state, engaged.id);
  return {
    id: engaged.id,
    state: {
      ...engaged.state,
      instances: { ...engaged.state.instances, [engaged.id]: { ...instance, damage: damageOn } },
    },
  };
}

const play = (state: GameState, event: { readonly card: { readonly id: CardId } }) =>
  playFree(state, deps, event.card.id);
const threatOn = (state: GameState): number => mustInstance(state, state.mainScheme.instanceId).threat;
const villainDamage = (state: GameState): number => mustInstance(state, state.villains[0]!.instanceId).damage;
const inPlay = (state: GameState, id: InstanceId): boolean => state.players[0]!.playArea.includes(id);
const inEncounterDiscard = (state: GameState, id: InstanceId): boolean =>
  activeEncounterDeck(state).discard.includes(id);
const typesFor = (events: readonly GameEvent[], id: InstanceId): readonly string[] =>
  events.filter((event) => "instanceId" in event && event.instanceId === id).map((event) => event.type);
const discardedAsVulnerable = (events: readonly GameEvent[], id: InstanceId) =>
  events.filter((event) => event.type === "vulnerableDiscarded" && event.instanceId === id);
const defeats = (events: readonly GameEvent[]): number =>
  events.filter((event) => event.type === "characterDefeated").length;
const damageDealtTo = (events: readonly GameEvent[], id: InstanceId): number =>
  events.reduce(
    (total, event) => (event.type === "damageDealt" && event.targetInstanceId === id ? total + event.amount : total),
    0,
  );

describe("§3.1 vulnerable (RRG 1.8 p. 48)", () => {
  it("a vulnerable minion (3 hit points) that is stunned is discarded, not defeated", () => {
    const { state: before, id } = withMinion(GUARD);
    const { state, events } = play(before, STUN);
    expect(inPlay(state, id)).toBe(false);
    expect(inEncounterDiscard(state, id)).toBe(true);
    expect(discardedAsVulnerable(events, id)).toEqual([
      { type: "vulnerableDiscarded", instanceId: id, cardId: GUARD.id, status: "stunned" },
    ]);
    // The cause is logged between the status card landing and the discard.
    const types = typesFor(events, id);
    expect(types.indexOf("statusGiven")).toBeLessThan(types.indexOf("vulnerableDiscarded"));
    expect(types.indexOf("vulnerableDiscarded")).toBeLessThan(types.indexOf("cardDiscardedFromPlay"));
    // No defeat: its "When Defeated: place 1 threat" did not resolve.
    expect(defeats(events)).toBe(0);
    expect(threatOn(state)).toBe(threatOn(before));
    expect(mustInstance(state, id).statuses).toMatchObject({ stunned: 0, confused: 0 });
  });

  it("a confused vulnerable minion with Victory 1 goes to the encounter discard pile, not the victory display", () => {
    const { state: before, id } = withMinion(SUPREME);
    const { state, events } = play(before, CONFUSE);
    expect(inEncounterDiscard(state, id)).toBe(true);
    expect(state.victoryDisplay).toEqual([]);
    expect(discardedAsVulnerable(events, id)).toMatchObject([{ status: "confused" }]);
    expect(defeats(events)).toBe(0);
    expect(threatOn(state)).toBe(threatOn(before));
  });

  it("confused and dealt 2 damage with 1 hit point remaining: discarded, 0 damage dealt, not defeated", () => {
    for (const event of [CONFUSE_AND_DAMAGE, DAMAGE_AND_CONFUSE]) {
      const { state: before, id } = withMinion(GUARD, 2);
      const { state, events } = play(before, event);
      expect(inEncounterDiscard(state, id)).toBe(true);
      expect(discardedAsVulnerable(events, id)).toHaveLength(1);
      expect(damageDealtTo(events, id)).toBe(0);
      expect(defeats(events)).toBe(0);
      expect(threatOn(state)).toBe(threatOn(before));
    }
  });

  it("an overkill attack for 3 that also stuns deals no excess damage to the villain", () => {
    const { state: before, id } = withMinion(GUARD);
    const { state, events } = play(before, OVERKILL_AND_STUN);
    expect(inEncounterDiscard(state, id)).toBe(true);
    expect(discardedAsVulnerable(events, id)).toHaveLength(1);
    expect(damageDealtTo(events, id)).toBe(0);
    expect(villainDamage(state)).toBe(villainDamage(before));
    expect(defeats(events)).toBe(0);
  });

  it("damage before a 'then' resolves first: 3 damage defeats the minion and the stun finds nobody", () => {
    const { state: before, id } = withMinion(GUARD);
    const { state, events } = play(before, DAMAGE_THEN_STUN);
    expect(damageDealtTo(events, id)).toBe(3);
    expect(defeats(events)).toBe(1);
    expect(discardedAsVulnerable(events, id)).toEqual([]);
    expect(threatOn(state)).toBe(threatOn(before) + 1);
  });

  it("steady and vulnerable: the first stunned card stays, the second discards it", () => {
    const { state: before, id } = withMinion(VETERAN);
    const first = play(before, STUN);
    expect(inPlay(first.state, id)).toBe(true);
    expect(mustInstance(first.state, id).statuses.stunned).toBe(1);
    expect(discardedAsVulnerable(first.events, id)).toEqual([]);
    const second = play(first.state, STUN);
    expect(inEncounterDiscard(second.state, id)).toBe(true);
    expect(discardedAsVulnerable(second.events, id)).toHaveLength(1);
    expect(defeats(second.events)).toBe(0);
  });

  it("steady and vulnerable holding 1 stunned card: a confused card is its first of that type and stays", () => {
    const { state: before, id } = withMinion(VETERAN);
    const { state, events } = play(play(before, STUN).state, CONFUSE);
    expect(inPlay(state, id)).toBe(true);
    expect(mustInstance(state, id).statuses).toMatchObject({ stunned: 1, confused: 1 });
    expect(discardedAsVulnerable(events, id)).toEqual([]);
  });

  it("a stunned card with no room on a vulnerable minion that already holds one changes nothing", () => {
    const { state: engaged, id } = withMinion(GUARD);
    const instance = mustInstance(engaged, id);
    const before: GameState = {
      ...engaged,
      instances: { ...engaged.instances, [id]: { ...instance, statuses: { ...instance.statuses, stunned: 1 } } },
    };
    const { state, events } = play(before, STUN);
    expect(inPlay(state, id)).toBe(true);
    expect(mustInstance(state, id).statuses.stunned).toBe(1);
    expect(typesFor(events, id)).toEqual([]);
  });

  it("stalwart and vulnerable: no status card can be placed, so it is never discarded", () => {
    const { state: before, id } = withMinion(ZEALOT);
    const { state, events } = play(play(before, STUN).state, CONFUSE);
    expect(inPlay(state, id)).toBe(true);
    expect(mustInstance(state, id).statuses).toMatchObject({ stunned: 0, confused: 0 });
    expect(discardedAsVulnerable(events, id)).toEqual([]);
  });

  it("tough and vulnerable, dealt 2 damage and confused: discarded with its tough status card unspent", () => {
    const { state: engaged, id } = withMinion(BRUISER);
    const instance = mustInstance(engaged, id);
    const before: GameState = {
      ...engaged,
      instances: { ...engaged.instances, [id]: { ...instance, statuses: { ...instance.statuses, tough: 1 } } },
    };
    const { state, events } = play(before, DAMAGE_AND_CONFUSE);
    expect(inEncounterDiscard(state, id)).toBe(true);
    expect(discardedAsVulnerable(events, id)).toHaveLength(1);
    expect(events.filter((event) => event.type === "statusRemoved" && event.status === "tough")).toEqual([]);
    expect(events.filter((event) => event.type === "damagePrevented")).toEqual([]);
  });

  it("a vulnerable card that cannot leave play (permanent) stays and keeps the status card", () => {
    const { state: before, id } = withMinion(FIXTURE);
    const { state, events } = play(before, STUN);
    expect(inPlay(state, id)).toBe(true);
    expect(mustInstance(state, id).statuses.stunned).toBe(1);
    expect(discardedAsVulnerable(events, id)).toEqual([]);
    expect(events).toContainEqual({ type: "leavePlayBlocked", instanceId: id, reason: "permanent" });
  });

  it("a minion that gains vulnerable from a constant is discarded like one that prints it", () => {
    const { state: before, id } = withMinion(RECRUIT);
    const { state, events } = play(before, CONFUSE);
    expect(inEncounterDiscard(state, id)).toBe(true);
    expect(discardedAsVulnerable(events, id)).toHaveLength(1);
    expect(defeats(events)).toBe(0);
  });

  it("a minion without vulnerable is stunned and stays; damage and confuse written damage first still deals 2", () => {
    const stunned = withMinion(THUG);
    const afterStun = play(stunned.state, STUN);
    expect(inPlay(afterStun.state, stunned.id)).toBe(true);
    expect(mustInstance(afterStun.state, stunned.id).statuses.stunned).toBe(1);
    expect(discardedAsVulnerable(afterStun.events, stunned.id)).toEqual([]);

    const hit = withMinion(THUG);
    const afterHit = play(hit.state, DAMAGE_AND_CONFUSE);
    expect(mustInstance(afterHit.state, hit.id)).toMatchObject({ damage: 2, statuses: { confused: 1 } });
    // Nothing was reordered: the damage is logged before the status card.
    const order = afterHit.events.filter((event) => event.type === "damageDealt" || event.type === "statusGiven");
    expect(order.map((event) => event.type)).toEqual(["damageDealt", "statusGiven"]);
  });
});
