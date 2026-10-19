/**
 * `TriggerEvent boostCardBeingGiven` (docs/phase7-wave11-scenarios.md E23): "Interrupt: When an enemy would be given a
 * facedown boost card, remove 1[per_hero] support counters from here instead." (Public Support 60163b, `fne`). One
 * event per card, before it is given, pushed only when an ability could react; the give is the event's apply step.
 *
 * Sources: RRG 1.8 "Attack (Enemy Activation)" step 1 (p. 8) and "Scheme (Enemy Activation)" step 1 (p. 39): "give it
 * one facedown boost card from the encounter deck"; "Boost, Boost Icon" (p. 11); "'Would'" (p. 48); "Replacement
 * Effect" (p. 37): "When an effect is replaced, it is no longer considered imminent and no further interrupts or
 * responses to that effect can be triggered."
 *
 * Synthetic cards only: a shield that replaces a give while it holds a support counter, a watcher that counts the
 * gives it hears coming, a witness of the gives made (`boostCardGiven`), and the cards that give.
 */

import { describe, expect, it } from "vitest";
import type { EngineDeps } from "./abilities.js";
import { replay, type GameSession } from "./engine.js";
import type { GameEvent } from "./events.js";
import type { InstanceId } from "./ids.js";
import { mustInstance } from "./query.js";
import type { EffectSpec, TargetRef } from "./spec.js";
import type { GameState } from "./state.js";
import { depsOf, stubAbility } from "./testing/abilities.js";
import { runCommands } from "./testing/drive.js";
import { stubEvent, stubSupport, stubTreachery } from "./testing/fixtures.js";
import { copiesOf, gameAtFirstTurn, P1, playerCardIntoPlay, playFree } from "./testing/wave3.js";
import type { TriggerEvent } from "./trigger-events.js";

const you = { kind: "controller" } as const;
const self: TargetRef = { kind: "self" };
const theVillain: TargetRef = { kind: "villain" };
const n = (value: number) => ({ kind: "const", value }) as const;
const bump = (counterType: string): EffectSpec => ({ kind: "addCounters", target: self, counterType, amount: n(1) });

/** "Forced Interrupt: When an enemy would be given a facedown boost card, remove 1 support counter from here instead." */
const SHIELD_INTERRUPT = stubAbility("shield.forced-interrupt", {
  trigger: {
    kind: "interrupt",
    forced: true,
    would: true,
    on: { on: "boostCardBeingGiven" },
    while: { kind: "counterAtLeast", of: self, counterType: "support", amount: 1 },
  },
  effects: [
    {
      kind: "replaceTriggeringEvent",
      with: [{ kind: "removeCounters", target: self, counterType: "support", amount: n(1) }],
    },
  ],
});
const SHIELD = stubSupport({ id: "shield", cost: 0, abilities: [SHIELD_INTERRUPT.ref] });
/** "Forced Interrupt: When an enemy would be given a facedown boost card, place 1 seen counter here." */
const WATCHER_INTERRUPT = stubAbility("watcher.forced-interrupt", {
  trigger: { kind: "interrupt", forced: true, on: { on: "boostCardBeingGiven" } },
  effects: [bump("seen")],
});
const WATCHER = stubSupport({ id: "watcher", cost: 0, abilities: [WATCHER_INTERRUPT.ref] });
/** "Forced Response: After an enemy is given a facedown boost card, place 1 given counter here." */
const WITNESS_RESPONSE = stubAbility("witness.response", {
  trigger: { kind: "response", forced: true, on: { on: "boostCardGiven" } },
  effects: [bump("given")],
});
const WITNESS = stubSupport({ id: "witness", cost: 0, abilities: [WITNESS_RESPONSE.ref] });
/** A response to the "would" event: the event is interrupt-only, so it never answers. */
const LATE_RESPONSE = stubAbility("late.response", {
  trigger: { kind: "response", forced: true, on: { on: "boostCardBeingGiven" } },
  effects: [bump("late")],
});
const LATE = stubSupport({ id: "late", cost: 0, abilities: [LATE_RESPONSE.ref] });

const FILLER = stubTreachery({ id: "filler", boostIcons: 0 });
/** "Boost: Give this enemy 1 additional boost card for this activation." */
const EXTRA_BOOST = stubAbility("extra.boost", {
  trigger: { kind: "boost" },
  effects: [{ kind: "modifyAttack", extraBoostCards: 1 }],
});
const EXTRA = stubTreachery({ id: "extra", boostIcons: 0, abilities: [EXTRA_BOOST.ref] });

const event = (id: string, effects: readonly EffectSpec[]) => {
  const ability = stubAbility(`${id}.action`, { trigger: { kind: "action" }, effects });
  return { card: stubEvent({ id, cost: 0, abilities: [ability.ref] }), ability };
};
// "The villain attacks you. Give the villain 1 additional boost card for that activation."
const ASSAULT = event("assault", [{ kind: "enemyAttack", enemies: theVillain, against: you, extraBoostCards: n(1) }]);
// "Give the villain 2 facedown boost cards."
const GIFT = event("gift", [{ kind: "giveBoostCard", enemy: theVillain, count: n(2) }]);
// "Give the topmost card of the encounter discard pile to the villain as a facedown boost card."
const PASS = event("pass", [
  { kind: "selectCards", slot: "top", cards: { kind: "encounter", zones: ["discard"], topmostOnly: true } },
  { kind: "giveBoostCard", enemy: theVillain, card: { kind: "slot", slot: "top" } },
]);
// "The villain attacks you." / "Give the villain 1 facedown boost card."
const STRIKE = event("strike", [{ kind: "enemyAttack", enemies: theVillain, against: you }]);
const GIFT_ONE = event("gift-one", [{ kind: "giveBoostCard", enemy: theVillain }]);
const EVENTS = [ASSAULT, GIFT, PASS, STRIKE, GIFT_ONE];
const SUPPORTS = [SHIELD, WATCHER, WITNESS, LATE];

const HEARD: EngineDeps = depsOf(
  SHIELD_INTERRUPT,
  WATCHER_INTERRUPT,
  WITNESS_RESPONSE,
  LATE_RESPONSE,
  EXTRA_BOOST,
  ...EVENTS.map((e) => e.ability),
);
/** The same registry with no ability that hears a give coming. */
const UNHEARD: EngineDeps = depsOf(WITNESS_RESPONSE, ...EVENTS.map((e) => e.ability));

function start(deps: EngineDeps): GameState {
  return gameAtFirstTurn({
    players: 1,
    cards: [...SUPPORTS, FILLER, EXTRA, ...EVENTS.map((e) => e.card)],
    deps,
    deck: [...SUPPORTS.map((s) => s.id), ...EVENTS.map((e) => e.card.id)],
    encounter: [EXTRA.id, ...copiesOf(FILLER.id, 30)],
  });
}

/** `card` in P1's play area with `support` support counters on it (surgery). */
function withCard(state: GameState, card: { readonly id: string }, support = 0) {
  const put = playerCardIntoPlay(state, card.id as never);
  const instance = mustInstance(put.state, put.id);
  return {
    id: put.id,
    state: {
      ...put.state,
      instances: { ...put.state.instances, [put.id]: { ...instance, counters: support > 0 ? { support } : {} } },
    } as GameState,
  };
}

const playRound = (state: GameState, deps: EngineDeps) =>
  runCommands(state, deps, ...state.players.map((p) => ({ type: "endTurn" as const, playerId: p.playerId })));

const encounterPiles = (state: GameState) => Object.values(state.encounterDecks)[0]!;
const villainOf = (state: GameState): InstanceId => state.villains[0]!.instanceId;
/** One encounter deck card moved to the top of the encounter discard pile, faceup (test surgery). */
const discardOne = (state: GameState): { readonly state: GameState; readonly id: InstanceId } => {
  const [deckId, piles] = Object.entries(state.encounterDecks)[0]!;
  const id = piles.deck[piles.deck.length - 1]!;
  const moved = { deck: piles.deck.filter((card) => card !== id), discard: [id, ...piles.discard] };
  const instances = { ...state.instances, [id]: { ...mustInstance(state, id), faceup: true } };
  return { id, state: { ...state, instances, encounterDecks: { ...state.encounterDecks, [deckId]: moved } } };
};

/** The encounter deck's one Extra moved to its top (test surgery). */
const extraOnTop = (state: GameState): GameState => {
  const [deckId, piles] = Object.entries(state.encounterDecks)[0]!;
  const id = piles.deck.find((card) => mustInstance(state, card).cardId === EXTRA.id)!;
  const deck = [id, ...piles.deck.filter((card) => card !== id)];
  return { ...state, encounterDecks: { ...state.encounterDecks, [deckId]: { ...piles, deck } } };
};
/** `id`'s support counters set to `support` (surgery). */
const withSupport = (state: GameState, id: InstanceId, support: number): GameState => ({
  ...state,
  instances: { ...state.instances, [id]: { ...mustInstance(state, id), counters: { support } } },
});

type Phase = "initiated" | "resolved" | "cancelled";
type BeingGiven = Extract<TriggerEvent, { kind: "boostCardBeingGiven" }>;
const coming = (events: readonly GameEvent[], phase: Phase): readonly BeingGiven[] =>
  events.flatMap((e) =>
    e.type === "triggerEvent" && e.phase === phase && e.event.kind === "boostCardBeingGiven" ? [e.event] : [],
  );
const anyComing = (events: readonly GameEvent[]) =>
  events.some((e) => e.type === "triggerEvent" && e.event.kind === "boostCardBeingGiven");
const dealt = (events: readonly GameEvent[]): readonly InstanceId[] =>
  events.flatMap((e) => (e.type === "boostCardDealt" ? [e.instanceId] : []));
const counter = (state: GameState, id: InstanceId, type: string) => mustInstance(state, id).counters[type] ?? 0;
function expectReplays(session: GameSession, deps: EngineDeps) {
  const replayed = replay(session.log, deps);
  if (!replayed.ok) throw new Error(replayed.error.message);
  expect(replayed.state).toEqual(session.state);
}

describe("boostCardBeingGiven: when an enemy would be given a facedown boost card", () => {
  it("the villain phase's activation, not replaced: 1 window before the card is given, then boostCardGiven", () => {
    const watcher = withCard(start(HEARD), WATCHER);
    const witness = withCard(watcher.state, WITNESS);
    const { state, events, session } = playRound(witness.state, HEARD);
    const heard = coming(events, "resolved");
    expect(heard).toHaveLength(1);
    expect(heard[0]).toMatchObject({ enemyInstanceId: villainOf(witness.state), playerId: P1 });
    expect(heard[0]!.outsideActivation).toBeUndefined();
    expect(heard[0]!.named).toBeUndefined();
    expect(counter(state, watcher.id, "seen")).toBe(1);
    // The window opened before the card left the deck.
    const window = events.findIndex((e) => e.type === "windowOpened" && e.event.kind === "boostCardBeingGiven");
    const give = events.findIndex((e) => e.type === "boostCardDealt");
    expect(window).toBeGreaterThan(-1);
    expect(give).toBeGreaterThan(window);
    expect(counter(state, witness.id, "given")).toBe(1);
    expectReplays(session, HEARD);
  });

  it("replaced: no card is given, the deck's top card stays on top and no boostCardGiven follows", () => {
    const shield = withCard(start(HEARD), SHIELD, 1);
    const witness = withCard(shield.state, WITNESS);
    const top = encounterPiles(witness.state).deck[0];
    const { state, events, session } = playRound(witness.state, HEARD);
    expect(coming(events, "cancelled")).toHaveLength(1);
    expect(dealt(events)).toEqual([]);
    expect(counter(state, shield.id, "support")).toBe(0);
    expect(counter(state, witness.id, "given")).toBe(0);
    // The activation had no boost card; the next card the round took (step three's) was that top card.
    expect(events.some((e) => e.type === "boostCardFlipped")).toBe(false);
    expect(events.some((e) => e.type === "cardMoved" && e.instanceId === top && e.to.kind === "dealtEncounter")).toBe(
      true,
    );
    expectReplays(session, HEARD);
  });

  it("a response to the would-event never answers: it is interrupt-only", () => {
    const late = withCard(start(HEARD), LATE);
    const { state } = playRound(late.state, HEARD);
    expect(counter(state, late.id, "late")).toBe(0);
  });

  it("an activation's own card and its additional one: 2 windows, one replaced, the other given the same top card", () => {
    const shield = withCard(start(HEARD), SHIELD, 1);
    const watcher = withCard(shield.state, WATCHER);
    const top = encounterPiles(watcher.state).deck[0];
    const { state, events, session } = playFree(watcher.state, HEARD, ASSAULT.card.id);
    const all = coming(events, "initiated");
    expect(all).toHaveLength(2);
    expect(all.every((e) => e.activation === "attack" && e.playerId === P1)).toBe(true);
    expect(coming(events, "cancelled")).toHaveLength(1);
    // The replaced give is no longer imminent: the watcher's interrupt, a tier after the "would" one, hears only the
    // second (RRG 1.8 "Replacement Effect", p. 37; "'Would'", p. 48).
    expect(counter(state, watcher.id, "seen")).toBe(1);
    expect(counter(state, shield.id, "support")).toBe(0);
    // The first give was replaced, so the card left on top was the one the second give took.
    expect(dealt(events)).toEqual([top]);
    expectReplays(session, HEARD);
  });

  it("a card ability's give off the deck: one window per card, outside an activation", () => {
    const shield = withCard(start(HEARD), SHIELD, 1);
    const watcher = withCard(shield.state, WATCHER);
    const villain = villainOf(watcher.state);
    const { state, events, session } = playFree(watcher.state, HEARD, GIFT.card.id);
    const all = coming(events, "initiated");
    expect(all).toHaveLength(2);
    expect(all.every((e) => e.outsideActivation === true && e.activation === null && e.playerId === null)).toBe(true);
    expect(dealt(events)).toHaveLength(1);
    expect(mustInstance(state, villain).boostCards).toHaveLength(1);
    expect(counter(state, watcher.id, "seen")).toBe(1);
    expectReplays(session, HEARD);
  });

  it("a named card: replaced, it stays in the encounter discard pile; not replaced, it is given", () => {
    const shield = withCard(start(HEARD), SHIELD, 1);
    const discarded = discardOne(shield.state);
    const villain = villainOf(discarded.state);
    const first = playFree(discarded.state, HEARD, PASS.card.id);
    expect(coming(first.events, "cancelled").map((e) => e.named?.instanceId)).toEqual([discarded.id]);
    expect(encounterPiles(first.state).discard[0]).toBe(discarded.id);
    expect(mustInstance(first.state, villain).boostCards).toEqual([]);
    expectReplays(first.session, HEARD);
    const second = playFree(first.state, HEARD, PASS.card.id);
    // With no support counter left the shield cannot react, so no window opens and the card is given at once.
    expect(anyComing(second.events)).toBe(false);
    expect(mustInstance(second.state, villain).boostCards).toEqual([discarded.id]);
    expect(mustInstance(second.state, discarded.id).faceup).toBe(false);
    expectReplays(second.session, HEARD);
  });

  it("a named card heard but not replaced: given by the event's apply step, then announced as given", () => {
    const watcher = withCard(start(HEARD), WATCHER);
    const witness = withCard(watcher.state, WITNESS);
    const discarded = discardOne(witness.state);
    const villain = villainOf(discarded.state);
    const { state, events, session } = playFree(discarded.state, HEARD, PASS.card.id);
    expect(coming(events, "resolved").map((e) => e.named?.instanceId)).toEqual([discarded.id]);
    expect(mustInstance(state, villain).boostCards).toEqual([discarded.id]);
    expect(counter(state, watcher.id, "seen")).toBe(1);
    expect(counter(state, witness.id, "given")).toBe(1);
    expectReplays(session, HEARD);
  });

  it("an additional boost card a Boost ability adds during the flip step: its own window, replaced, nothing given", () => {
    // Extra waits facedown on the villain, given while the shield had no counter (no window could open).
    const shield = withCard(extraOnTop(start(HEARD)), SHIELD, 0);
    const villain = villainOf(shield.state);
    const gift = playFree(shield.state, HEARD, GIFT_ONE.card.id);
    expect(anyComing(gift.events)).toBe(false);
    const extra = mustInstance(gift.state, villain).boostCards[0]!;
    expect(mustInstance(gift.state, extra).cardId).toBe(EXTRA.id);
    // Two counters: one for the attack's own boost card, one for the card Extra's Boost adds once it is turned up.
    const { state, events, session } = playFree(withSupport(gift.state, shield.id, 2), HEARD, STRIKE.card.id);
    const flip = events.findIndex((e) => e.type === "boostCardFlipped" && e.instanceId === extra);
    expect(flip).toBeGreaterThan(-1);
    const after = events.slice(flip);
    const windowsAfter = after.filter((e) => e.type === "windowOpened" && e.event.kind === "boostCardBeingGiven");
    expect(windowsAfter).toHaveLength(1);
    expect(coming(after, "cancelled")).toHaveLength(1);
    expect(coming(after, "cancelled")[0]).toMatchObject({ activation: "attack", playerId: P1 });
    expect(coming(after, "cancelled")[0]!.outsideActivation).toBeUndefined();
    expect(dealt(events)).toEqual([]);
    expect(counter(state, shield.id, "support")).toBe(0);
    expect(events.filter((e) => e.type === "boostCardFlipped")).toHaveLength(1);
    expectReplays(session, HEARD);
  });

  it("a registry with no ability that hears one: no event, and the card is given at once", () => {
    const witness = withCard(start(UNHEARD), WITNESS);
    const round = playRound(witness.state, UNHEARD);
    expect(anyComing(round.events)).toBe(false);
    expect(dealt(round.events)).toHaveLength(1);
    expect(counter(round.state, witness.id, "given")).toBe(1);
    const gift = playFree(round.state, UNHEARD, GIFT.card.id);
    expect(anyComing(gift.events)).toBe(false);
    expect(dealt(gift.events)).toHaveLength(2);
  });
});
