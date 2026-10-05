/**
 * `AbilityTriggerSpec stateCheck` with `fromEntering`: a standing condition printed as a constant ability ("If Fantomex
 * is not in play, discard E.V.A.", `next_evol` 40021) resolves when it is first seen already true, not only when it
 * becomes true later.
 *
 * RRG 1.8 "Ability" (p. 4): "A constant ability becomes active as soon as its card enters play and remains active while
 * the card is in play", and one that seeks a condition ("during", "if", "while") is "active anytime the specific
 * condition is met". The first look waits for the card's own entering play to finish, so what it enters play with (its
 * uses counters, "enters play with N counters") is in place; after it the check is edge-triggered and does not repeat
 * while the condition stays true. A check without the flag keeps the old reading (docs/phase7-wave1.md §4.1): its first
 * observation only records.
 */

import type { AnyCard } from "@mc/content";
import { describe, expect, it } from "vitest";
import type { EngineDeps } from "./abilities.js";
import type { Command } from "./commands.js";
import { replay, startSession } from "./engine.js";
import type { GameEvent } from "./events.js";
import type { InstanceId } from "./ids.js";
import { locateCard, mustInstance, mustPlayer } from "./query.js";
import type { EffectSpec, Predicate, TargetRef } from "./spec.js";
import type { GameState } from "./state.js";
import { depsOf, stubAbility } from "./testing/abilities.js";
import { driveSession } from "./testing/drive.js";
import { stubAlly, stubEvent, stubSupport } from "./testing/fixtures.js";
import { defaultPick, giveCard } from "./testing/scenario.js";
import { gameAtFirstTurn, P1 } from "./testing/wave3.js";

const one = { kind: "const", value: 1 } as const;
const two = { kind: "const", value: 2 } as const;
const you = { kind: "controller" } as const;
const self: TargetRef = { kind: "self" };
const slot = (name: string): TargetRef => ({ kind: "slot", slot: name });
const BUDDY = stubAlly({ id: "buddy", cost: 0, atk: 1, thw: 1, hp: 3 });
const NO_BUDDY: Predicate = { kind: "not", of: { kind: "exists", query: { name: BUDDY.name } } };
const noCounters = (counterType: string): Predicate => ({
  kind: "not",
  of: { kind: "counterAtLeast", of: self, counterType, amount: 1 },
});
const DISCARD_SELF: readonly EffectSpec[] = [{ kind: "discardFromPlay", target: self }];
const MARK_FIRED: readonly EffectSpec[] = [{ kind: "addCounters", target: self, counterType: "fired", amount: one }];

/** "If Buddy is not in play, discard this card." */
const PAL_CHECK = stubAbility("pal.check", {
  trigger: { kind: "stateCheck", when: NO_BUDDY, fromEntering: true },
  effects: [...DISCARD_SELF],
});
const PAL = stubSupport({ id: "pal", cost: 0, abilities: [PAL_CHECK.ref] });
/** The same text without the flag: the first observation only records. */
const OLD_PAL_CHECK = stubAbility("old-pal.check", {
  trigger: { kind: "stateCheck", when: NO_BUDDY },
  effects: [...DISCARD_SELF],
});
const OLD_PAL = stubSupport({ id: "old-pal", cost: 0, abilities: [OLD_PAL_CHECK.ref] });
/** "If Buddy is not in play, place a fired counter here": the condition outlives its own effect. */
const LOOKOUT_CHECK = stubAbility("lookout.check", {
  trigger: { kind: "stateCheck", when: NO_BUDDY, fromEntering: true },
  effects: [...MARK_FIRED],
});
const LOOKOUT = stubSupport({ id: "lookout", cost: 0, abilities: [LOOKOUT_CHECK.ref] });
/** "Uses (2 charge counters). If there are no charge counters here, place a fired counter here." */
const BATTERY_CHECK = stubAbility("battery.check", {
  trigger: { kind: "stateCheck", when: noCounters("charge"), fromEntering: true },
  effects: [...MARK_FIRED],
});
const BATTERY = stubSupport({
  id: "battery",
  cost: 0,
  keywords: [{ name: "uses", count: 2, counterType: "charge" }],
  abilities: [BATTERY_CHECK.ref],
});
/** "Enters play with 2 fuel counters. If there are no fuel counters here, place a fired counter here." */
const TANK_FILLS = stubAbility("tank.fills", {
  trigger: { kind: "response", forced: true, on: { on: "cardEntersPlay", selfIs: "target" } },
  effects: [{ kind: "addCounters", target: self, counterType: "fuel", amount: two }],
});
const TANK_CHECK = stubAbility("tank.check", {
  trigger: { kind: "stateCheck", when: noCounters("fuel"), fromEntering: true },
  effects: [...MARK_FIRED],
});
const TANK = stubSupport({ id: "tank", cost: 0, abilities: [TANK_FILLS.ref, TANK_CHECK.ref] });

const event = (id: string, effects: readonly EffectSpec[]) => {
  const ability = stubAbility(`${id}.action`, { trigger: { kind: "action" }, effects: [...effects] });
  return { card: stubEvent({ id, cost: 0, abilities: [ability.ref] }), ability };
};
/** "Discard each ally." */
const DISMISS = event("dismiss", [
  { kind: "discardFromPlay", target: { kind: "each", query: { categories: ["ally"] } } },
]);
/** "Search your deck, discard pile and hand for Pal and put it into play." */
const SUMMON_PAL = event("summon-pal", [
  {
    kind: "chooseCards",
    slot: "found",
    from: { kind: "zone", zone: ["deck", "discard", "hand"], player: you, filter: { name: PAL.name } },
    chooser: you,
    min: 1,
    max: 1,
  },
  { kind: "putIntoPlay", card: slot("found"), controller: you },
]);
/** "Remove 1 fuel counter from each support." */
const SIPHON = event("siphon", [
  {
    kind: "removeCounters",
    target: { kind: "each", query: { categories: ["support"] } },
    counterType: "fuel",
    amount: one,
  },
]);

const CHECKS = [PAL_CHECK, OLD_PAL_CHECK, LOOKOUT_CHECK, BATTERY_CHECK, TANK_FILLS, TANK_CHECK];
const EVENTS = [DISMISS, SUMMON_PAL, SIPHON];
const deps: EngineDeps = depsOf(...CHECKS, ...EVENTS.map((e) => e.ability));
const PLAYER_CARDS: readonly AnyCard[] = [BUDDY, PAL, OLD_PAL, LOOKOUT, BATTERY, TANK, ...EVENTS.map((e) => e.card)];

const start = (): GameState =>
  gameAtFirstTurn({ cards: [...PLAYER_CARDS], deps, deck: [...PLAYER_CARDS, SIPHON.card].map((card) => card.id) });

interface Step {
  readonly state: GameState;
  readonly events: readonly GameEvent[];
  readonly id: InstanceId;
}
/** Plays `card` from hand for 0 and checks the log replays to the same state. */
function play(state: GameState, card: AnyCard, ...more: readonly Command[]): Step {
  const given = giveCard(state, P1, card.id);
  const command: Command = {
    type: "playCard",
    playerId: P1,
    cardInstanceId: given.id,
    payment: [],
    attachToInstanceId: null,
  };
  const { session, events } = driveSession(startSession(given.state), deps, [command, ...more], defaultPick);
  const replayed = replay(session.log, deps);
  expect(replayed.ok && replayed.state).toEqual(session.state);
  return { state: session.state, events, id: given.id };
}
const inPlay = (state: GameState, id: InstanceId) => mustPlayer(state, P1).playArea.includes(id);
const counters = (state: GameState, id: InstanceId) => mustInstance(state, id).counters;
const resolved = (events: readonly GameEvent[], abilityId: string) =>
  events.filter((e) => e.type === "abilityResolved" && e.abilityId === abilityId).length;

describe("a `fromEntering` state check resolves when its condition is already true as the card enters play", () => {
  it("played with the condition true: it resolves once, at once, and the card is in the discard pile", () => {
    const { state, events, id } = play(start(), PAL);
    expect(inPlay(state, id)).toBe(false);
    expect(locateCard(state, id)?.kind).toBe("discard");
    expect(resolved(events, "pal.check")).toBe(1);
    // It entered play first: a constant is active "as soon as its card enters play" (RRG 1.8 p. 4).
    const order = events.flatMap((e) =>
      e.type === "cardMoved" && e.instanceId === id ? [`${e.from.kind}>${e.to.kind}`] : [],
    );
    expect(order).toEqual(["hand>playArea", "playArea>discard"]);
  });

  it("put into play by an effect with the condition true: the same, 1 resolution", () => {
    const base = start();
    const { state, events } = play(base, SUMMON_PAL.card);
    const seat = mustPlayer(state, P1);
    expect(seat.playArea.filter((id) => state.instances[id]?.cardId === PAL.id)).toEqual([]);
    expect(resolved(events, "pal.check")).toBe(1);
  });

  it("played with the condition false it stays; when the condition becomes true later it resolves (the edge)", () => {
    const buddy = play(start(), BUDDY);
    const pal = play(buddy.state, PAL);
    expect(inPlay(pal.state, pal.id)).toBe(true);
    expect(resolved(pal.events, "pal.check")).toBe(0);
    const gone = play(pal.state, DISMISS.card);
    expect(inPlay(gone.state, pal.id)).toBe(false);
    expect(resolved(gone.events, "pal.check")).toBe(1);
  });

  it("without the flag the first observation only records: the card stays in play with its condition true", () => {
    const old = play(start(), OLD_PAL);
    expect(inPlay(old.state, old.id)).toBe(true);
    expect(resolved(old.events, "old-pal.check")).toBe(0);
    // False once, then true again: it resolves on that edge.
    const buddy = play(old.state, BUDDY);
    const gone = play(buddy.state, DISMISS.card);
    expect(inPlay(gone.state, old.id)).toBe(false);
  });

  it("does not repeat while the condition stays true: 1 after entering, 1 a round later, 2 after it was false once", () => {
    const lookout = play(start(), LOOKOUT);
    expect(counters(lookout.state, lookout.id).fired).toBe(1);
    const nextRound = driveSession(startSession(lookout.state), deps, [{ type: "endTurn", playerId: P1 }], defaultPick);
    expect(nextRound.session.state.round).toBe(2);
    expect(counters(nextRound.session.state, lookout.id).fired).toBe(1);
    const buddy = play(nextRound.session.state, BUDDY);
    expect(counters(buddy.state, lookout.id).fired).toBe(1);
    const gone = play(buddy.state, DISMISS.card);
    expect(counters(gone.state, lookout.id).fired).toBe(2);
  });

  it("waits for what the card enters play with: 2 uses counters placed, the 'no counters' check does not resolve", () => {
    const battery = play(start(), BATTERY);
    expect(counters(battery.state, battery.id)).toEqual({ charge: 2 });
    expect(resolved(battery.events, "battery.check")).toBe(0);
  });

  it("…and for a forced 'enters play with 2 counters' response; it resolves once the last counter is removed", () => {
    const tank = play(start(), TANK);
    expect(counters(tank.state, tank.id)).toEqual({ fuel: 2 });
    expect(resolved(tank.events, "tank.check")).toBe(0);
    const one_ = play(tank.state, SIPHON.card);
    expect(counters(one_.state, tank.id)).toEqual({ fuel: 1 });
    const none = play(one_.state, SIPHON.card);
    expect(counters(none.state, tank.id)).toMatchObject({ fuel: 0, fired: 1 });
    expect(resolved(none.events, "tank.check")).toBe(1);
  });
});
