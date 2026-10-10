/**
 * A hit point dial stops at zero (`settleDials`, `resolve/state-checks.ts`).
 *
 * RRG 1.8 "Hit Points" (p. 22): "An identity's or villain's hit point dial represents their remaining hit points. If an
 * identity or villain is damaged, apply the damage by reducing that character's hit point dial by the specified
 * amount", and a "+X hit points" that ends reduces the dial by X. A dial has no reading below zero, so an identity or
 * villain that stays in play past zero ("cannot be defeated") keeps damage equal to its maximum hit points: a heal of 4
 * then leaves 4 remaining. The damage itself is dealt and taken in full: the log, a damage instruction's `amount` and
 * its excess (RRG 1.8 "Overkill", p. 31) read the amount taken.
 *
 * An ally's or minion's damage is tokens, placed in "the specified value" (RRG 1.8 "Damage", p. 14) and counted past
 * its hit points ("zero or fewer remaining hit points", p. 22; "any damage on that ally beyond its hit points", p. 31),
 * so one that cannot be defeated keeps every token. Synthetic cards only.
 */

import { flat } from "@mc/content";
import { describe, expect, it } from "vitest";
import type { EngineDeps } from "./abilities.js";
import { replay } from "./engine.js";
import type { GameEvent } from "./events.js";
import type { InstanceId } from "./ids.js";
import { activeVillain, maxHitPoints, mustInstance, mustPlayer, remainingHitPoints } from "./query.js";
import { cardsInPlay } from "./select.js";
import type { EffectSpec, TargetRef, ValueSpec } from "./spec.js";
import type { GameState } from "./state.js";
import { depsOf, stubAbility } from "./testing/abilities.js";
import { stubAttachment, stubEvent, stubMinion, stubSupport, stubVillain } from "./testing/fixtures.js";
import { copiesOf, gameAtFirstTurn, minionEngagedWith, P1, playerCardIntoPlay, playFree } from "./testing/wave3.js";

const theVillain: TargetRef = { kind: "villain" };
const you: TargetRef = { kind: "identityOf", player: { kind: "controller" } };
const n = (value: number): ValueSpec => ({ kind: "const", value });

/** "[This character] cannot be defeated." */
const CANNOT_FALL = stubAbility("held.constant", {
  trigger: { kind: "constant", rules: [{ kind: "cannotBeDefeated", target: { self: true } }] },
  effects: [],
});
/** Citizen V's shape, without the condition: 24 hit points, cannot be defeated. */
const HELD = stubVillain({
  id: "dial-held",
  stages: [
    { hp: flat(24), atk: 1, sch: 1, abilities: [CANNOT_FALL.ref] },
    { hp: flat(30), atk: 1, sch: 1 },
  ],
});
const PLAIN = stubVillain({
  id: "dial-plain",
  stages: [
    { hp: flat(24), atk: 1, sch: 1 },
    { hp: flat(30), atk: 1, sch: 1 },
  ],
});
/** "Your identity cannot be defeated." */
const WARD_RULE = stubAbility("ward.constant", {
  trigger: { kind: "constant", rules: [{ kind: "cannotBeDefeated", target: { categories: ["identity"] } }] },
  effects: [],
});
const WARD = stubSupport({ id: "dial-ward", cost: 0, abilities: [WARD_RULE.ref] });
/** A 3 hit point minion that cannot be defeated. */
const STUBBORN = stubMinion({ id: "dial-stubborn", atk: 1, sch: 1, hp: 3, abilities: [CANNOT_FALL.ref] });
/** "Attached villain gets +5 hit points." */
const PLATING_CONSTANT = stubAbility("plating.constant", {
  trigger: { kind: "constant", modifiers: [{ stat: "hp", amount: 5, target: { hostOfSelf: true } }] },
  effects: [],
});
const PLATING = stubAttachment({ id: "dial-plating", abilities: [PLATING_CONSTANT.ref] });

const event = (id: string, effects: readonly EffectSpec[]) => {
  const ability = stubAbility(`${id}.action`, { trigger: { kind: "action" }, effects });
  return { card: stubEvent({ id, cost: 0, abilities: [ability.ref] }), ability };
};
const HIT_2 = event("dial-hit-2", [{ kind: "dealDamage", target: theVillain, amount: n(2) }]);
/** "Deal 5 damage to the villain. Place 1 'dealt' counter on your identity for each damage dealt this way, and 1 'excess' counter for each excess damage." */
const HIT_5_COUNTED = event("dial-hit-5", [
  { kind: "dealDamage", target: theVillain, amount: n(5), bind: "hit" },
  { kind: "addCounters", target: you, counterType: "dealt", amount: { kind: "var", name: "hit.amount" } },
  { kind: "addCounters", target: you, counterType: "excess", amount: { kind: "var", name: "hit.excessDealt" } },
]);
const HEAL_4 = event("dial-heal-4", [{ kind: "heal", target: theVillain, amount: n(4) }]);
const HURT_ME_15 = event("dial-hurt-me", [{ kind: "dealDamage", target: you, amount: n(15) }]);
const HEAL_ME_3 = event("dial-heal-me", [{ kind: "heal", target: you, amount: n(3) }]);
const SMASH_10 = event("dial-smash", [
  { kind: "dealDamage", target: { kind: "each", query: { categories: ["minion"] } }, amount: n(10) },
]);
const MEND_2 = event("dial-mend", [
  { kind: "heal", target: { kind: "each", query: { categories: ["minion"] } }, amount: n(2) },
]);
const STRIP = event("dial-strip", [
  { kind: "discardFromPlay", target: { kind: "each", query: { categories: ["attachment"] } } },
]);
const EVENTS = [HIT_2, HIT_5_COUNTED, HEAL_4, HURT_ME_15, HEAL_ME_3, SMASH_10, MEND_2, STRIP];

const deps: EngineDeps = depsOf(CANNOT_FALL, WARD_RULE, PLATING_CONSTANT, ...EVENTS.map((e) => e.ability));

function start(villain: typeof HELD): GameState {
  return gameAtFirstTurn({
    deps,
    villain,
    cards: [WARD, STUBBORN, PLATING, ...EVENTS.map((e) => e.card)],
    encounter: [STUBBORN.id, PLATING.id],
    deck: [WARD.id, ...EVENTS.flatMap((e) => copiesOf(e.card.id, 2))],
  });
}

const villainId = (state: GameState) => activeVillain(state).instanceId;
const withDamage = (state: GameState, id: InstanceId, damage: number): GameState => ({
  ...state,
  instances: { ...state.instances, [id]: { ...mustInstance(state, id), damage } },
});
const damageOn = (state: GameState, id: InstanceId) => mustInstance(state, id).damage;
const left = (state: GameState, id: InstanceId) => remainingHitPoints(state, id, deps);
const of = <T extends GameEvent["type"]>(events: readonly GameEvent[], type: T) =>
  events.filter((e): e is Extract<GameEvent, { type: T }> => e.type === type);
const play = (state: GameState, card: (typeof EVENTS)[number]) => playFree(state, deps, card.card.id);

/** Attaches an encounter card to the villain (surgery: no reveal). */
function attached(state: GameState, card: string): { state: GameState; id: InstanceId } {
  const villain = villainId(state);
  const id = (Object.keys(state.instances) as InstanceId[]).find(
    (key) => state.instances[key]?.cardId === card && !cardsInPlay(state).includes(key),
  );
  if (!id) throw new Error(`no ${card} out of play`);
  return {
    id,
    state: {
      ...state,
      encounterDecks: Object.fromEntries(
        Object.entries(state.encounterDecks).map(([deckId, piles]) => [
          deckId,
          { ...piles, deck: piles.deck.filter((x) => x !== id) },
        ]),
      ),
      instances: {
        ...state.instances,
        [id]: { ...mustInstance(state, id), faceup: true, attachedTo: villain, controllerId: null },
        [villain]: { ...mustInstance(state, villain), attachments: [...mustInstance(state, villain).attachments, id] },
      },
    },
  };
}

describe("a villain that cannot be defeated, hit past zero (RRG 1.8 'Hit Points', p. 22)", () => {
  it("23 of 24, hit for 2: 2 are dealt, his dial reads 0 (24 damage, not 25), and a heal of 4 leaves 4", () => {
    const base = start(HELD);
    const villain = villainId(base);
    const hit = play(withDamage(base, villain, 23), HIT_2);
    expect(of(hit.events, "damageDealt")).toMatchObject([{ targetInstanceId: villain, amount: 2 }]);
    expect(of(hit.events, "damageBeyondZeroLost")).toEqual([
      { type: "damageBeyondZeroLost", instanceId: villain, cardId: HELD.id, amount: 1, damage: 24 },
    ]);
    expect(damageOn(hit.state, villain)).toBe(24);
    expect(left(hit.state, villain)).toBe(0);
    expect(of(hit.events, "characterDefeated")).toEqual([]);
    expect(activeVillain(hit.state).stageIndex).toBe(0);
    expect(hit.state.heldAtZero).toEqual([villain]);

    const healed = play(hit.state, HEAL_4);
    expect(of(healed.events, "damageHealed")).toMatchObject([{ targetInstanceId: villain, amount: 4 }]);
    expect(damageOn(healed.state, villain)).toBe(20);
    expect(left(healed.state, villain)).toBe(4);
    expect(healed.state.heldAtZero ?? []).toEqual([]);

    const replayed = replay(healed.session.log, deps);
    expect(replayed.ok && replayed.state).toEqual(healed.state);
  });

  it("the damage is dealt in full: 5 on 2 remaining reports 5 dealt and 3 excess to the instruction that dealt it", () => {
    const base = start(HELD);
    const villain = villainId(base);
    const hit = play(withDamage(base, villain, 22), HIT_5_COUNTED);
    const hero = mustPlayer(hit.state, P1).identity.instanceId;
    expect(of(hit.events, "damageDealt")).toMatchObject([{ targetInstanceId: villain, amount: 5 }]);
    expect(mustInstance(hit.state, hero).counters).toMatchObject({ dealt: 5, excess: 3 });
    expect(damageOn(hit.state, villain)).toBe(24);
    expect(left(hit.state, villain)).toBe(0);
  });

  it("already at 0, every further hit is dealt and none is kept", () => {
    const base = start(HELD);
    const villain = villainId(base);
    const first = play(withDamage(base, villain, 24), HIT_2);
    const second = play(first.state, HIT_2);
    expect(of([...first.events, ...second.events], "damageDealt").map((e) => e.amount)).toEqual([2, 2]);
    expect(of([...first.events, ...second.events], "damageBeyondZeroLost").map((e) => e.amount)).toEqual([2, 2]);
    expect(damageOn(second.state, villain)).toBe(24);
  });

  it("a '+5 hit points' that ends takes his dial from 2 to 0, not below: 27 damage on 29 becomes 24 on 24", () => {
    const base = start(HELD);
    const villain = villainId(base);
    const plated = attached(withDamage(base, villain, 27), PLATING.id);
    expect(maxHitPoints(plated.state, villain, deps)).toBe(29);
    expect(left(plated.state, villain)).toBe(2);
    const stripped = play(plated.state, STRIP);
    expect(cardsInPlay(stripped.state)).not.toContain(plated.id);
    expect(maxHitPoints(stripped.state, villain, deps)).toBe(24);
    expect(damageOn(stripped.state, villain)).toBe(24);
    expect(of(stripped.events, "damageBeyondZeroLost")).toMatchObject([{ instanceId: villain, amount: 3, damage: 24 }]);
    expect(left(play(stripped.state, HEAL_4).state, villain)).toBe(4);
  });
});

describe("a villain that is defeated keeps nothing to settle", () => {
  it("23 of 24, hit for 5: the stage falls with the damage as dealt, the next stage starts undamaged, nothing is logged as lost", () => {
    const base = start(PLAIN);
    const villain = villainId(base);
    const hit = play(withDamage(base, villain, 23), HIT_5_COUNTED);
    const hero = mustPlayer(hit.state, P1).identity.instanceId;
    expect(activeVillain(hit.state).stageIndex).toBe(1);
    expect(damageOn(hit.state, villain)).toBe(0);
    expect(mustInstance(hit.state, hero).counters).toMatchObject({ dealt: 5, excess: 4 });
    expect(of(hit.events, "damageBeyondZeroLost")).toEqual([]);
  });
});

describe("an identity that cannot be defeated, hit past zero", () => {
  it("15 damage on 10 hit points: 15 are dealt, the dial reads 0, and a heal of 3 leaves 3", () => {
    const ward = playerCardIntoPlay(start(PLAIN), WARD.id);
    const hero = mustPlayer(ward.state, P1).identity.instanceId;
    const before = damageOn(ward.state, hero);
    const hit = play(ward.state, HURT_ME_15);
    expect(of(hit.events, "damageDealt")).toMatchObject([{ targetInstanceId: hero, amount: 15 }]);
    expect(of(hit.events, "damageBeyondZeroLost")).toMatchObject([
      { instanceId: hero, amount: before + 5, damage: 10 },
    ]);
    expect(damageOn(hit.state, hero)).toBe(10);
    expect(mustPlayer(hit.state, P1).eliminated).toBe(false);
    const healed = play(hit.state, HEAL_ME_3);
    expect(left(healed.state, hero)).toBe(3);
  });
});

describe("an ally or minion keeps its damage tokens past its hit points (RRG 1.8 pp. 14, 22, 31)", () => {
  it("a 3 hit point minion that cannot be defeated takes 10: 10 tokens stay, and healing 2 leaves 8", () => {
    const minion = minionEngagedWith(start(PLAIN), STUBBORN.id);
    const hit = play(minion.state, SMASH_10);
    expect(damageOn(hit.state, minion.id)).toBe(10);
    expect(of(hit.events, "damageBeyondZeroLost")).toEqual([]);
    expect(cardsInPlay(hit.state)).toContain(minion.id);
    const mended = play(hit.state, MEND_2);
    expect(damageOn(mended.state, minion.id)).toBe(8);
    expect(cardsInPlay(mended.state)).toContain(minion.id);
  });
});
