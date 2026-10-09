/**
 * RRG 1.8 "Hit Points" (p. 22): "If an ability that says an ally or minion 'gets +X hit points' ceases to be in effect
 * and causes that ally or minion to have damage on it equal to or greater than its hit points, that ally or minion is
 * defeated." For an identity or villain: "If that ability later ceases to be in effect, reduce that character's hit
 * point dial by X", and a dial at zero is a defeat (same entry; "Defeat", p. 15).
 *
 * `checkHitPointsFell` (`resolve/state-checks.ts`) notices the fall between frames. It is an edge: a character already
 * at zero and deliberately kept in play ("cannot be defeated", a hit point floor) is not defeated again by a bonus
 * ending. Synthetic cards only.
 */

import { flat } from "@mc/content";
import { describe, expect, it } from "vitest";
import type { EngineDeps } from "./abilities.js";
import { replay } from "./engine.js";
import type { GameEvent } from "./events.js";
import type { InstanceId } from "./ids.js";
import { locateCard, maxHitPoints, mustInstance, mustPlayer } from "./query.js";
import { cardsInPlay } from "./select.js";
import type { EffectSpec, Predicate, ValueSpec } from "./spec.js";
import type { GameState } from "./state.js";
import { depsOf, stubAbility } from "./testing/abilities.js";
import {
  stubAlly,
  stubAttachment,
  stubEvent,
  stubMainScheme,
  stubMinion,
  stubTreachery,
  stubUpgrade,
  stubVillain,
} from "./testing/fixtures.js";
import { copiesOf, gameAtFirstTurn, minionEngagedWith, P1, playerCardIntoPlay, playFree } from "./testing/wave3.js";

const n = (value: number): ValueSpec => ({ kind: "const", value });
const HOST = { hostOfSelf: true } as const;
const mainSchemeThreat: ValueSpec = { kind: "threat", of: { kind: "mainScheme" } };
const threatAtLeast = (value: number): Predicate => ({
  kind: "compare",
  left: mainSchemeThreat,
  op: "atLeast",
  right: n(value),
});

/** "Attached character gets +3 hit points." */
const PLATING_CONSTANT = stubAbility("plating.constant", {
  trigger: { kind: "constant", modifiers: [{ stat: "hp", amount: 3, target: HOST }] },
  effects: [],
});
const PLATING = stubAttachment({ id: "plating", abilities: [PLATING_CONSTANT.ref] });
/** The same text on a player card, for a character a player controls. */
const VEST = stubUpgrade({ id: "vest", cost: 0, abilities: [PLATING_CONSTANT.ref] });

/** "Attached character cannot be defeated." */
const WARD_CONSTANT = stubAbility("ward.constant", {
  trigger: { kind: "constant", rules: [{ kind: "cannotBeDefeated", target: HOST }] },
  effects: [],
});
const WARD = stubAttachment({ id: "ward", abilities: [WARD_CONSTANT.ref] });

/** "Attached character is considered to have at least 1 hit point." */
const FLOOR_CONSTANT = stubAbility("floor.constant", {
  trigger: { kind: "constant", rules: [{ kind: "consideredRemainingHp", target: HOST, atLeast: 1 }] },
  effects: [],
});
const FLOOR = stubAttachment({ id: "floor", abilities: [FLOOR_CONSTANT.ref] });

const BRUTE = stubMinion({ id: "brute", atk: 0, sch: 0, hp: 3, boostIcons: 0 });
/** "If there is at least 2 threat on the main scheme, this minion gets +3 hit points." */
const SWOLLEN_CONSTANT = stubAbility("swollen.constant", {
  trigger: {
    kind: "constant",
    modifiers: [{ stat: "hp", amount: 3, target: { self: true }, while: threatAtLeast(2) }],
  },
  effects: [],
});
const SWOLLEN = stubMinion({ id: "swollen", atk: 0, sch: 0, hp: 3, boostIcons: 0, abilities: [SWOLLEN_CONSTANT.ref] });
const GUARD_ALLY = stubAlly({ id: "squire", cost: 0, atk: 1, thw: 1, hp: 2 });

const action = (id: string, ...effects: EffectSpec[]) => {
  const ability = stubAbility(`${id}.action`, { trigger: { kind: "action" }, effects });
  return { card: stubEvent({ id, cost: 0, abilities: [ability.ref] }), ability };
};
/** "Discard each [name] in play." One per card, so a test strips exactly the card it means to. */
const strip = (id: string, cardId: string) =>
  action(id, { kind: "discardFromPlay", target: { kind: "each", query: { name: cardId } } });
const STRIP = strip("strip", PLATING.id);
const STRIP_VEST = strip("strip-vest", VEST.id);
const STRIP_WARD = strip("strip-ward", WARD.id);
const STRIP_FLOOR = strip("strip-floor", FLOOR.id);
const CALM = action("calm", { kind: "removeThreat", target: { kind: "mainScheme" }, amount: n(1) });
const HIT = action("hit", { kind: "dealDamage", target: { kind: "named", name: BRUTE.name }, amount: n(7) });
const EVENTS = [STRIP, STRIP_VEST, STRIP_WARD, STRIP_FLOOR, CALM, HIT];

const SCHEME = stubMainScheme({
  id: "long",
  stages: [{ startingThreat: flat(2), targetThreat: flat(99), acceleration: flat(0) }],
});
const TYRANT = stubVillain({ id: "tyrant", stages: [{ hp: flat(8), atk: 0, sch: 0 }] });
const FILLER = stubTreachery({ id: "filler", boostIcons: 0 });

const deps: EngineDeps = depsOf(
  PLATING_CONSTANT,
  WARD_CONSTANT,
  FLOOR_CONSTANT,
  SWOLLEN_CONSTANT,
  ...EVENTS.map((e) => e.ability),
);

function start(): GameState {
  return gameAtFirstTurn({
    cards: [BRUTE, SWOLLEN, GUARD_ALLY, PLATING, VEST, WARD, FLOOR, FILLER, ...EVENTS.map((e) => e.card)],
    deps,
    villain: TYRANT,
    mainScheme: SCHEME,
    encounter: [BRUTE.id, SWOLLEN.id, PLATING.id, WARD.id, FLOOR.id, ...copiesOf(FILLER.id, 12)],
    deck: [GUARD_ALLY.id, VEST.id, ...EVENTS.map((e) => e.card.id)],
  });
}

const patch = (state: GameState, id: InstanceId, damage: number): GameState => ({
  ...state,
  instances: { ...state.instances, [id]: { ...mustInstance(state, id), damage } },
});
/** Attaches a card to `host` (surgery: no reveal, no play), from the encounter deck or from P1's deck. */
function attach(state: GameState, card: string, host: InstanceId): { state: GameState; id: InstanceId } {
  const id = (Object.keys(state.instances) as InstanceId[]).find(
    (key) => state.instances[key]?.cardId === card && !cardsInPlay(state).includes(key),
  );
  if (!id) throw new Error(`no ${card} out of play`);
  const without = (ids: readonly InstanceId[]) => ids.filter((x) => x !== id);
  return {
    id,
    state: {
      ...state,
      encounterDecks: Object.fromEntries(
        Object.entries(state.encounterDecks).map(([deckId, piles]) => [
          deckId,
          { ...piles, deck: without(piles.deck) },
        ]),
      ),
      players: state.players.map((p) => ({ ...p, deck: without(p.deck), hand: without(p.hand) })),
      instances: {
        ...state.instances,
        [id]: {
          ...mustInstance(state, id),
          faceup: true,
          attachedTo: host,
          controllerId: mustInstance(state, host).controllerId,
        },
        [host]: { ...mustInstance(state, host), attachments: [...mustInstance(state, host).attachments, id] },
      },
    },
  };
}
const of = <T extends GameEvent["type"]>(events: readonly GameEvent[], type: T) =>
  events.filter((e): e is Extract<GameEvent, { type: T }> => e.type === type);
const inPlay = (state: GameState, id: InstanceId) => cardsInPlay(state).includes(id);

/** A Brute engaged with P1 wearing Plating (6 hit points), with `damage` on it. */
function platedBrute(damage: number) {
  const brute = minionEngagedWith(start(), BRUTE.id);
  const plated = attach(brute.state, PLATING.id, brute.id);
  return { state: patch(plated.state, brute.id, damage), brute: brute.id, plating: plated.id };
}

describe('RRG 1.8 "Hit Points" (p. 22): a hit point bonus that ends at or below the damage defeats the character', () => {
  it("a minion with 4 damage on 3 + 3 hit points is defeated when the +3 leaves play, with no defeating player", () => {
    const { state, brute } = platedBrute(4);
    expect(maxHitPoints(state, brute, deps)).toBe(6);
    const run = playFree(state, deps, STRIP.card.id);
    expect(inPlay(run.state, brute)).toBe(false);
    expect(locateCard(run.state, brute)?.kind).toBe("encounterDiscard");
    expect(of(run.events, "hitPointsFell")).toEqual([
      { type: "hitPointsFell", instanceId: brute, cardId: BRUTE.id, from: 6, to: 3, damage: 4 },
    ]);
    expect(of(run.events, "characterDefeated").map((e) => e.instanceId)).toEqual([brute]);
    // The log says why before it says what.
    const order = run.events.filter((e) => e.type === "hitPointsFell" || e.type === "characterDefeated");
    expect(order.map((e) => e.type)).toEqual(["hitPointsFell", "characterDefeated"]);
    expect(run.state.hitPointsSeen).toBeUndefined();
    const replayed = replay(run.session.log, deps);
    if (!replayed.ok) throw new Error(replayed.error.message);
    expect(replayed.state).toEqual(run.state);
  });

  it("exactly equal counts: 3 damage on 3 hit points is defeated", () => {
    const { state, brute } = platedBrute(3);
    expect(inPlay(playFree(state, deps, STRIP.card.id).state, brute)).toBe(false);
  });

  it("2 damage on 3 hit points is not: the minion stays, and its new hit points are what is remembered", () => {
    const { state, brute } = platedBrute(2);
    const run = playFree(state, deps, STRIP.card.id);
    expect(inPlay(run.state, brute)).toBe(true);
    expect(of(run.events, "hitPointsFell")).toHaveLength(0);
    expect(run.state.hitPointsSeen).toEqual({ [brute]: 3 });
  });

  it("a bonus that ends because the value it counts dropped: threat removed from the scheme ends '+3 while 2 threat'", () => {
    const swollen = minionEngagedWith(start(), SWOLLEN.id);
    expect(maxHitPoints(swollen.state, swollen.id, deps)).toBe(6);
    const run = playFree(patch(swollen.state, swollen.id, 4), deps, CALM.card.id);
    expect(mustInstance(run.state, run.state.mainScheme.instanceId).threat).toBe(1);
    expect(inPlay(run.state, swollen.id)).toBe(false);
    expect(of(run.events, "hitPointsFell")).toMatchObject([{ instanceId: swollen.id, from: 6, to: 3 }]);
  });

  it("an ally a player controls: its upgrade discarded with 4 damage on 2 + 3 hit points, it goes to its owner's discard", () => {
    const ally = playerCardIntoPlay(start(), GUARD_ALLY.id);
    const vested = attach(ally.state, VEST.id, ally.id);
    const run = playFree(patch(vested.state, ally.id, 4), deps, STRIP_VEST.card.id);
    expect(inPlay(run.state, ally.id)).toBe(false);
    expect(mustPlayer(run.state, P1).discard).toContain(ally.id);
  });

  it("an identity: the dial comes down by 3 and reaches zero, so the player is eliminated", () => {
    const base = start();
    const hero = mustPlayer(base, P1).identity.instanceId;
    const vested = attach(base, VEST.id, hero);
    expect(maxHitPoints(vested.state, hero, deps)).toBe(13);
    const run = playFree(patch(vested.state, hero, 10), deps, STRIP_VEST.card.id);
    expect(of(run.events, "hitPointsFell")).toMatchObject([{ instanceId: hero, from: 13, to: 10, damage: 10 }]);
    expect(run.state.outcome).toMatchObject({ result: "loss" });
  });

  it("a villain: the dial comes down by 3 and reaches zero, so its stage is defeated", () => {
    const base = start();
    const villain = base.villains[0]!.instanceId;
    const plated = attach(base, PLATING.id, villain);
    const run = playFree(patch(plated.state, villain, 9), deps, STRIP.card.id);
    expect(run.state.outcome).toMatchObject({ result: "win" });
  });
});

describe("the sweep is an edge: a character deliberately at zero is not defeated again", () => {
  it("'cannot be defeated' at 7 damage on 6: losing the +3 changes nothing; losing the protection defeats it once", () => {
    const { state, brute } = platedBrute(0);
    const struck = playFree(attach(state, WARD.id, brute).state, deps, HIT.card.id);
    expect(mustInstance(struck.state, brute).damage).toBe(7);
    expect(struck.state.heldAtZero).toEqual([brute]);
    const run = playFree(struck.state, deps, STRIP.card.id);
    expect(maxHitPoints(run.state, brute, deps)).toBe(3);
    expect(inPlay(run.state, brute)).toBe(true);
    // Already at zero before the bonus ended: nothing crossed, so nothing is announced or swept.
    expect(of(run.events, "hitPointsFell")).toHaveLength(0);
    expect(of(run.events, "characterDefeated")).toHaveLength(0);

    const freed = playFree(run.state, deps, STRIP_WARD.card.id);
    expect(inPlay(freed.state, brute)).toBe(false);
    expect(of(freed.events, "characterDefeated")).toHaveLength(1);
  });

  it("'cannot be defeated' at 4 damage on 6: the +3 ending takes it to zero, where the rule holds it and watches it", () => {
    const { state, brute } = platedBrute(4);
    const warded = attach(state, WARD.id, brute);
    const run = playFree(warded.state, deps, STRIP.card.id);
    expect(inPlay(run.state, brute)).toBe(true);
    expect(of(run.events, "hitPointsFell")).toHaveLength(1);
    expect(of(run.events, "characterDefeated")).toHaveLength(0);
    expect(run.state.heldAtZero).toEqual([brute]);
    // Nothing more happens while it stands there: another card played, the same character, no second sweep.
    const later = playFree(run.state, deps, CALM.card.id);
    expect(inPlay(later.state, brute)).toBe(true);
    expect(of(later.events, "hitPointsFell")).toHaveLength(0);
    // The protection gone, it falls by the rule that watched it.
    const freed = playFree(later.state, deps, STRIP_WARD.card.id);
    expect(of(freed.events, "defeatProtectionEnded")).toHaveLength(1);
    expect(inPlay(freed.state, brute)).toBe(false);
  });

  it("a hit point floor holds it the same way: 'considered to have at least 1 hit point' survives the +3 ending", () => {
    const { state, brute } = platedBrute(4);
    const floored = attach(state, FLOOR.id, brute);
    const run = playFree(floored.state, deps, STRIP.card.id);
    expect(inPlay(run.state, brute)).toBe(true);
    expect(run.state.heldAtZero).toEqual([brute]);
    const freed = playFree(run.state, deps, STRIP_FLOOR.card.id);
    expect(inPlay(freed.state, brute)).toBe(false);
    expect(of(freed.events, "characterDefeated")).toHaveLength(1);
  });

  it("an undamaged character is not remembered, and one first seen damaged only records", () => {
    const fresh = platedBrute(0);
    const run = playFree(fresh.state, deps, CALM.card.id);
    expect(run.state.hitPointsSeen).toBeUndefined();
    const hurt = playFree(platedBrute(5).state, deps, CALM.card.id);
    expect(Object.values(hurt.state.hitPointsSeen ?? {})).toEqual([6]);
    expect(of(hurt.events, "hitPointsFell")).toHaveLength(0);
  });
});
