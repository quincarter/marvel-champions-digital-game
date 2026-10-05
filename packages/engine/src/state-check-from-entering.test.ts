/**
 * `AbilityTriggerSpec stateCheck` with `fromEntering`: a standing condition printed as a constant ability ("If Fantomex
 * is not in play, discard E.V.A.", `next_evol` 40021) resolves when it is first seen already true, not only when it
 * becomes true later.
 *
 * RRG 1.8 "Ability" (p. 4): "A constant ability becomes active as soon as its card enters play and remains active while
 * the card is in play", and one that seeks a condition ("during", "if", "while") is "active anytime the specific
 * condition is met". Owner ruling 2026-10-05 (docs/phase7-wave7.md §4.1, on the NeXt Evolution FAQ "Can E.V.A. ever be
 * in play while Fantomex is not?"): the card is discarded immediately. So the first look is the moment the card is in
 * play: before any interrupt or response to its entering play is offered, and with the counters its uses keywords place
 * as it enters counted. A card the check takes out of play gets no enter-play window at all. After that first look the
 * check is edge-triggered and does not repeat while the condition stays true. A check without the flag keeps the old
 * reading (docs/phase7-wave1.md §4.1): its first observation only records.
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
/** "Response: After a support enters play, place a seen counter here." */
const GREETER_RESPONSE = stubAbility("greeter.response", {
  trigger: { kind: "response", forced: false, on: { on: "cardEntersPlay", targetIs: { categories: ["support"] } } },
  effects: [{ kind: "addCounters", target: self, counterType: "seen", amount: one }],
});
const GREETER = stubSupport({ id: "greeter", cost: 0, abilities: [GREETER_RESPONSE.ref] });
/** "Interrupt: When a support enters play, place a warned counter here." */
const SENTRY_INTERRUPT = stubAbility("sentry.interrupt", {
  trigger: { kind: "interrupt", forced: false, on: { on: "cardEntersPlay", targetIs: { categories: ["support"] } } },
  effects: [{ kind: "addCounters", target: self, counterType: "warned", amount: one }],
});
const SENTRY = stubSupport({ id: "sentry", cost: 0, abilities: [SENTRY_INTERRUPT.ref] });

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

const CHECKS = [
  PAL_CHECK,
  OLD_PAL_CHECK,
  LOOKOUT_CHECK,
  BATTERY_CHECK,
  TANK_FILLS,
  TANK_CHECK,
  GREETER_RESPONSE,
  SENTRY_INTERRUPT,
];
const EVENTS = [DISMISS, SUMMON_PAL, SIPHON];
const deps: EngineDeps = depsOf(...CHECKS, ...EVENTS.map((e) => e.ability));
const PLAYER_CARDS: readonly AnyCard[] = [
  BUDDY,
  PAL,
  OLD_PAL,
  LOOKOUT,
  BATTERY,
  TANK,
  GREETER,
  SENTRY,
  ...EVENTS.map((e) => e.card),
];

const start = (): GameState =>
  gameAtFirstTurn({ cards: [...PLAYER_CARDS], deps, deck: [...PLAYER_CARDS, SIPHON.card].map((card) => card.id) });

interface Step {
  readonly state: GameState;
  readonly events: readonly GameEvent[];
  readonly id: InstanceId;
}
/** Plays `card` from hand for 0 and checks the log replays to the same state. */
const play = (state: GameState, card: AnyCard, ...more: readonly Command[]): Step =>
  playPicking(state, card, defaultPick, ...more);
/** Answers every choice with its first option: an optional ability offered is triggered. */
const takeOffer = (state: GameState) => state.pendingChoice!.options.slice(0, 1).map((o) => o.optionId);
function playPicking(
  state: GameState,
  card: AnyCard,
  pick: (state: GameState) => readonly string[],
  ...more: readonly Command[]
): Step {
  const given = giveCard(state, P1, card.id);
  const command: Command = {
    type: "playCard",
    playerId: P1,
    cardInstanceId: given.id,
    payment: [],
    attachToInstanceId: null,
  };
  const { session, events } = driveSession(startSession(given.state), deps, [command, ...more], pick);
  const replayed = replay(session.log, deps);
  expect(replayed.ok && replayed.state).toEqual(session.state);
  return { state: session.state, events, id: given.id };
}
const inPlay = (state: GameState, id: InstanceId) => mustPlayer(state, P1).playArea.includes(id);
const counters = (state: GameState, id: InstanceId) => mustInstance(state, id).counters;
const resolved = (events: readonly GameEvent[], abilityId: string) =>
  events.filter((e) => e.type === "abilityResolved" && e.abilityId === abilityId).length;
/**
 * What happened to `id`, in order: its moves, the abilities that resolved (anyone's), and each step of its entering
 * play (`enters:initiated`, an `interrupt`/`response` window with who was offered, `enters:resolved`).
 */
const story = (events: readonly GameEvent[], id: InstanceId): readonly string[] =>
  events.flatMap((e) => {
    if (e.type === "cardMoved" && e.instanceId === id) return [`${e.from.kind}>${e.to.kind}`];
    if (e.type === "abilityResolved") return [e.abilityId];
    if (e.type === "counterAdded" && e.instanceId === id) return [`+${e.amount} ${e.counterType}`];
    const about = (e.type === "triggerEvent" || e.type === "windowOpened") && e.event.kind === "cardEntersPlay";
    if (!about || e.event.instanceId !== id) return [];
    if (e.type === "triggerEvent") return [`enters:${e.phase}`];
    return [`${e.timing} window: ${e.candidates.map((c) => c.abilityId).join(", ")}`];
  });

describe("a `fromEntering` state check resolves when its condition is already true as the card enters play", () => {
  it("played with the condition true: it resolves once, at once, and the card is in the discard pile", () => {
    const { state, events, id } = play(start(), PAL);
    expect(inPlay(state, id)).toBe(false);
    expect(locateCard(state, id)?.kind).toBe("discard");
    expect(resolved(events, "pal.check")).toBe(1);
    // It entered play first: a constant is active "as soon as its card enters play" (RRG 1.8 p. 4). Then it is
    // discarded, and its entering play is never initiated: nothing to interrupt, nothing to respond to.
    expect(story(events, id)).toEqual(["hand>playArea", "pal.check", "playArea>discard"]);
    expect(state.stack).toEqual([]);
  });

  it("no response is offered for a card the check discards: 'After a support enters play' stays unoffered", () => {
    const greeter = play(start(), GREETER);
    const pal = play(greeter.state, PAL);
    expect(story(pal.events, pal.id)).toEqual(["hand>playArea", "pal.check", "playArea>discard"]);
    expect(pal.events.filter((e) => e.type === "windowOpened")).toEqual([]);
    expect(pal.events.filter((e) => e.type === "choiceRequested")).toEqual([]);
    expect(counters(pal.state, greeter.id).seen).toBeUndefined();
  });

  it("…nor an interrupt: 'When a support enters play' is not offered either", () => {
    const sentry = play(start(), SENTRY);
    const pal = play(sentry.state, PAL);
    expect(story(pal.events, pal.id)).toEqual(["hand>playArea", "pal.check", "playArea>discard"]);
    expect(pal.events.filter((e) => e.type === "windowOpened")).toEqual([]);
    expect(counters(pal.state, sentry.id).warned).toBeUndefined();
  });

  it("with the condition false the card's entering play is offered as any is: 1 response window, 1 seen counter", () => {
    const greeter = play(play(start(), BUDDY).state, GREETER);
    const pal = playPicking(greeter.state, PAL, takeOffer);
    expect(story(pal.events, pal.id)).toEqual([
      "hand>playArea",
      "enters:initiated",
      "enters:resolved",
      "response window: greeter.response",
      "greeter.response",
    ]);
    expect(inPlay(pal.state, pal.id)).toBe(true);
    expect(counters(pal.state, greeter.id).seen).toBe(1);
    expect(resolved(pal.events, "pal.check")).toBe(0);
  });

  it("a check that resolves at once and leaves the card in play: its entering play then goes on, response offered", () => {
    const greeter = play(start(), GREETER);
    const lookout = playPicking(greeter.state, LOOKOUT, takeOffer);
    expect(story(lookout.events, lookout.id)).toEqual([
      "hand>playArea",
      "lookout.check",
      "+1 fired",
      "enters:initiated",
      "enters:resolved",
      "response window: greeter.response",
      "greeter.response",
    ]);
    expect(counters(lookout.state, lookout.id).fired).toBe(1);
    expect(counters(lookout.state, greeter.id).seen).toBe(1);
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

  it("counts the uses counters the card enters play with: 2 about to be placed, 'no counters' does not resolve", () => {
    const battery = play(start(), BATTERY);
    expect(counters(battery.state, battery.id)).toEqual({ charge: 2 });
    expect(resolved(battery.events, "battery.check")).toBe(0);
    expect(story(battery.events, battery.id)).toEqual([
      "hand>playArea",
      "enters:initiated",
      "+2 charge",
      "enters:resolved",
    ]);
  });

  // The limit of the immediate reading: only a keyword's placement is known before the card's entering play resolves.
  // Counters scripted as a forced response arrive after the check has looked, so this card's check resolves on entry.
  it("does not count counters a forced response places: the check resolves first (1), then 2 fuel are placed", () => {
    const tank = play(start(), TANK);
    expect(counters(tank.state, tank.id)).toEqual({ fired: 1, fuel: 2 });
    expect(resolved(tank.events, "tank.check")).toBe(1);
    expect(story(tank.events, tank.id).slice(0, 4)).toEqual([
      "hand>playArea",
      "tank.check",
      "+1 fired",
      "enters:initiated",
    ]);
    // Edge-triggered from there: false with fuel on it, true again when the last one goes.
    const one_ = play(tank.state, SIPHON.card);
    expect(counters(one_.state, tank.id)).toEqual({ fired: 1, fuel: 1 });
    const none = play(one_.state, SIPHON.card);
    expect(counters(none.state, tank.id)).toMatchObject({ fuel: 0, fired: 2 });
    expect(resolved(none.events, "tank.check")).toBe(1);
  });
});
