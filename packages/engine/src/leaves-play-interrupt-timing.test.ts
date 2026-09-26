/**
 * docs/phase7-wave5.md §4.1 Q17: "When X leaves play" interrupts resolve before the card moves, with the card still in
 * play, still carrying its attachments, counters and controller; responses see it gone. Synthetic cards shaped like
 * Spider-Man (Hobie Brown) (`sm` 27017: "Interrupt: When Spider-Man leaves play, …"), Web of Life and Destiny (27023:
 * "Response: After a [Web-Warrior] ally leaves play, …") and a replacement in the shape of Abduct Superhumans (`aos`
 * 50081: tuck the card here instead).
 *
 * Sources: RRG 1.8 "Interrupt" (p. 25: an interrupt "resolves immediately before that triggering condition resolves"),
 * "Leaves Play" (p. 27); ruling Jan 17, 2026 (1) #2 (the "Leaves Play" bullets happen simultaneously with leaving, so
 * the attachments are still there for the interrupt).
 */

import { describe, expect, it } from "vitest";
import type { AbilityDefinition, EngineDeps } from "./abilities.js";
import { replay, type GameSession } from "./engine.js";
import type { GameEvent } from "./events.js";
import type { InstanceId } from "./ids.js";
import { mustInstance, mustPlayer } from "./query.js";
import type { EffectSpec, TargetRef, ValueSpec } from "./spec.js";
import type { GameState } from "./state.js";
import { depsOf, stubAbility, type StubAbility } from "./testing/abilities.js";
import { stubAlly, stubEvent, stubSupport, stubUpgrade } from "./testing/fixtures.js";
import { gameAtFirstTurn, P1, P2, playerCardIntoPlay, playFree } from "./testing/wave3.js";

const tracker: TargetRef = { kind: "each", query: { categories: ["support"], name: "tracker" } };
const hobieRef: TargetRef = { kind: "each", query: { name: "hobie" } };
const mark = (counterType: string, amount: ValueSpec): EffectSpec => ({
  kind: "addCounters",
  target: tracker,
  counterType,
  amount,
});
// 1 while Hobie is in play, 0 once he has left.
const hobieInPlay: ValueSpec = { kind: "count", query: { categories: ["ally"], name: "hobie" } };
// 1 while the gadget is still attached to him.
const gadgetOnHobie: ValueSpec = { kind: "count", query: { name: "hobie", hasAttachment: { name: "gadget" } } };
// 1 while Hobie is in play under P1's control.
const hobieYours: ValueSpec = { kind: "count", query: { categories: ["ally"], name: "hobie", controller: "you" } };
// 1 while Hobie is in play and owned by the interrupt's controller (P1).
const hobieOwned: ValueSpec = { kind: "count", query: { categories: ["ally"], name: "hobie", owner: "you" } };

/** "Interrupt: When [this ally] leaves play, …": records what it sees of itself. Forced, so no picker is needed. */
const HOBIE_INTERRUPT = stubAbility("hobie.interrupt", {
  trigger: { kind: "interrupt", forced: true, on: { on: "cardLeavesPlay", selfIs: "target" } },
  effects: [
    mark("interrupt", { kind: "const", value: 1 }),
    mark("inPlay", hobieInPlay),
    mark("attached", gadgetOnHobie),
    mark("web", { kind: "counters", of: { kind: "self" }, counterType: "web" }),
    mark("yours", hobieYours),
    mark("owned", hobieOwned),
  ],
});
const HOBIE = stubAlly({ id: "hobie", cost: 0, atk: 1, thw: 1, hp: 3, abilities: [HOBIE_INTERRUPT.ref] });
const PLAIN = stubAlly({ id: "hobie", cost: 0, atk: 1, thw: 1, hp: 3 });

/** "Response: After an ally leaves play, …": records whether it still sees Hobie in play. */
const TRACKER_RESPONSE = stubAbility("tracker.response", {
  trigger: { kind: "response", forced: true, on: { on: "cardLeavesPlay", targetIs: { categories: ["ally"] } } },
  effects: [mark("response", { kind: "const", value: 1 }), mark("responseInPlay", hobieInPlay)],
});
/** "Forced Interrupt: When an ally would leave play, tuck it under this card instead." */
const REPLACEMENT_DEFINITION: AbilityDefinition = {
  trigger: { kind: "interrupt", forced: true, on: { on: "cardLeavesPlay", targetIs: { categories: ["ally"] } } },
  effects: [
    {
      kind: "replaceTriggeringEvent",
      with: [
        mark("replaced", hobieInPlay),
        { kind: "tuckCards", cards: { kind: "ref", ref: { kind: "eventTarget" } }, under: tracker },
      ],
    },
  ],
};
const REPLACEMENT = stubAbility("tracker.replacement", REPLACEMENT_DEFINITION);

const GADGET = stubUpgrade({ id: "gadget", cost: 0 });

const event = (id: string, effects: readonly EffectSpec[]) => {
  const ability = stubAbility(`${id}.action`, { trigger: { kind: "action" }, effects });
  return { card: stubEvent({ id, cost: 0, abilities: [ability.ref] }), ability };
};
const MOVE_TO_DISCARD = event("move-to-discard", [
  { kind: "moveCards", cards: { kind: "ref", ref: hobieRef }, to: "discard" },
]);
const DISCARD_EFFECT = event("discard-effect", [{ kind: "discardFromPlay", target: hobieRef }]);
const SMASH = event("smash", [{ kind: "dealDamage", target: hobieRef, amount: { kind: "const", value: 5 } }]);
const EVENTS = [MOVE_TO_DISCARD, DISCARD_EFFECT, SMASH];
const TAKE = event("take", [
  { kind: "takeIntoHand", cards: { kind: "ref", ref: hobieRef }, player: { kind: "controller" } },
]);
/** Played events that do not send Hobie to the discard pile. */
const OTHER_EVENTS = [TAKE];
const ALL_EVENTS = [...EVENTS, ...OTHER_EVENTS];

function trackerWith(...abilities: readonly StubAbility[]) {
  return stubSupport({ id: "tracker", cost: 0, abilities: abilities.map((a) => a.ref) });
}

interface Table {
  readonly state: GameState;
  readonly deps: EngineDeps;
  readonly hobie: InstanceId;
  readonly gadget: InstanceId;
  readonly tracker: InstanceId;
}

/** Hobie in play with 2 web counters and the gadget attached, and the tracker support. */
function table(ally: typeof HOBIE, trackerAbilities: readonly StubAbility[], abilities: readonly StubAbility[]): Table {
  const TRACKER = trackerWith(...trackerAbilities);
  const deps = depsOf(...abilities, ...trackerAbilities, ...ALL_EVENTS.map((e) => e.ability));
  const start = gameAtFirstTurn({
    cards: [ally, GADGET, TRACKER, ...ALL_EVENTS.map((e) => e.card)],
    deps,
    deck: [ally.id, GADGET.id, TRACKER.id, ...ALL_EVENTS.map((e) => e.card.id)],
  });
  const tracker = playerCardIntoPlay(start, TRACKER.id);
  const hobie = playerCardIntoPlay(tracker.state, ally.id);
  const gadget = playerCardIntoPlay(hobie.state, GADGET.id);
  const s = gadget.state;
  // Surgery: the gadget attached to Hobie, and 2 web counters on him.
  const state: GameState = {
    ...s,
    players: s.players.map((p) =>
      p.playerId === P1 ? { ...p, playArea: p.playArea.filter((id) => id !== gadget.id) } : p,
    ),
    instances: {
      ...s.instances,
      [gadget.id]: { ...mustInstance(s, gadget.id), attachedTo: hobie.id },
      [hobie.id]: { ...mustInstance(s, hobie.id), attachments: [gadget.id], counters: { web: 2 } },
    },
  };
  return { state, deps, hobie: hobie.id, gadget: gadget.id, tracker: tracker.id };
}

const marks = (state: GameState, t: Table) => mustInstance(state, t.tracker).counters;
const inDiscard = (state: GameState, id: InstanceId) => mustPlayer(state, P1).discard.includes(id);
const expectReplays = (session: GameSession, deps: EngineDeps) => {
  const replayed = replay(session.log, deps);
  if (!replayed.ok) throw new Error(replayed.error.message);
  expect(replayed.state).toEqual(session.state);
};
const index = (events: readonly GameEvent[], found: (e: GameEvent) => boolean) => events.findIndex(found);

describe("§4.1 Q17 'When X leaves play' resolves before the card moves", () => {
  it("the interrupt sees the card in play with its attachments, counters and controller; the response sees it gone", () => {
    const t = table(HOBIE, [TRACKER_RESPONSE], [HOBIE_INTERRUPT]);
    const { state, events, session } = playFree(t.state, t.deps, MOVE_TO_DISCARD.card.id);
    expect(marks(state, t)).toMatchObject({
      interrupt: 1,
      inPlay: 1,
      attached: 1,
      web: 2,
      yours: 1,
      response: 1,
    });
    expect(marks(state, t)["responseInPlay"] ?? 0).toBe(0);
    // Then it left, whole: discarded, its attachment with it, its counters gone.
    expect(inDiscard(state, t.hobie)).toBe(true);
    expect(inDiscard(state, t.gadget)).toBe(true);
    expect(mustInstance(state, t.hobie).counters).toEqual({});
    // The interrupt resolved before the discard happened.
    const resolvedAt = index(events, (e) => e.type === "abilityResolved" && e.abilityId === HOBIE_INTERRUPT.ref.id);
    const discardedAt = index(events, (e) => e.type === "cardDiscardedFromPlay" && e.instanceId === t.hobie);
    expect(resolvedAt).toBeGreaterThanOrEqual(0);
    expect(resolvedAt).toBeLessThan(discardedAt);
    // The responses read where it went.
    const resolved = events.flatMap((e) =>
      e.type === "triggerEvent" && e.phase === "resolved" && e.event.kind === "cardLeavesPlay" ? [e.event] : [],
    );
    expect(resolved).toHaveLength(1);
    expect(resolved[0]).toMatchObject({ instanceId: t.hobie, to: "discard" });
    expect(resolved[0]).not.toHaveProperty("leaving");
    expect(state.stack).toEqual([]);
    expectReplays(session, t.deps);
  });

  it("a discard by effect goes through the same path", () => {
    const t = table(HOBIE, [TRACKER_RESPONSE], [HOBIE_INTERRUPT]);
    const { state, session } = playFree(t.state, t.deps, DISCARD_EFFECT.card.id);
    expect(marks(state, t)).toMatchObject({ interrupt: 1, inPlay: 1, attached: 1, web: 2, response: 1 });
    expect(marks(state, t)["responseInPlay"] ?? 0).toBe(0);
    expect(inDiscard(state, t.hobie)).toBe(true);
    expectReplays(session, t.deps);
  });

  it("a defeat by damage goes through the same path, after the defeat", () => {
    const t = table(HOBIE, [TRACKER_RESPONSE], [HOBIE_INTERRUPT]);
    const { state, events, session } = playFree(t.state, t.deps, SMASH.card.id);
    expect(marks(state, t)).toMatchObject({ interrupt: 1, inPlay: 1, attached: 1, web: 2, response: 1 });
    expect(marks(state, t)["responseInPlay"] ?? 0).toBe(0);
    expect(inDiscard(state, t.hobie)).toBe(true);
    expect(inDiscard(state, t.gadget)).toBe(true);
    const defeatedAt = index(
      events,
      (e) => e.type === "triggerEvent" && e.phase === "initiated" && e.event.kind === "characterDefeated",
    );
    const leavingAt = index(
      events,
      (e) => e.type === "triggerEvent" && e.phase === "initiated" && e.event.kind === "cardLeavesPlay",
    );
    expect(leavingAt).toBeGreaterThanOrEqual(0);
    expect(defeatedAt).toBeLessThan(leavingAt);
    expectReplays(session, t.deps);
  });

  it("a replacement sees the card in play and redirects the move; the responses see it gone, once", () => {
    const t = table(PLAIN, [REPLACEMENT, TRACKER_RESPONSE], []);
    const { state, events, session } = playFree(t.state, t.deps, MOVE_TO_DISCARD.card.id);
    expect(marks(state, t)).toMatchObject({ replaced: 1, response: 1 });
    expect(marks(state, t)["responseInPlay"] ?? 0).toBe(0);
    expect(mustInstance(state, t.tracker).tucked).toContain(t.hobie);
    expect(inDiscard(state, t.hobie)).toBe(false);
    // Tucking is leaving play too: its attachment went to the discard pile.
    expect(inDiscard(state, t.gadget)).toBe(true);
    expect(events.some((e) => e.type === "cardDiscardedFromPlay" && e.instanceId === t.hobie)).toBe(false);
    // The replaced leaving did not happen; the tuck is what left, announced for the responses only.
    const leavings = events.flatMap((e) =>
      e.type === "triggerEvent" && e.event.kind === "cardLeavesPlay" ? [`${e.phase}:${e.event.to}`] : [],
    );
    expect([...leavings].sort()).toEqual(["cancelled:discard", "initiated:discard", "resolved:tucked"]);
    expect(state.stack).toEqual([]);
    expectReplays(session, t.deps);
  });

  it("with nothing listening, a leaving logs nothing new and the card moves at once", () => {
    const t = table(PLAIN, [], []);
    for (const played of EVENTS) {
      const { state, events } = playFree(t.state, t.deps, played.card.id);
      expect(inDiscard(state, t.hobie)).toBe(true);
      expect(JSON.stringify(events)).not.toContain("cardLeavesPlay");
      expect(state.pendingLeftPlay).toBeUndefined();
    }
  });

  it("a response-only listener still hears it after the move, with no interrupt window before it", () => {
    const t = table(PLAIN, [TRACKER_RESPONSE], []);
    const { state, events, session } = playFree(t.state, t.deps, MOVE_TO_DISCARD.card.id);
    expect(marks(state, t)).toMatchObject({ response: 1 });
    expect(marks(state, t)["responseInPlay"] ?? 0).toBe(0);
    const discardedAt = index(events, (e) => e.type === "cardDiscardedFromPlay" && e.instanceId === t.hobie);
    const firstLeaving = index(events, (e) => e.type === "triggerEvent" && e.event.kind === "cardLeavesPlay");
    expect(discardedAt).toBeLessThan(firstLeaving);
    expectReplays(session, t.deps);
  });
});

describe("§4.1 Q35 'take it into your hand' changes its owner with the move", () => {
  it("the interrupt sees the card with its old owner; the new owner comes after, with the move", () => {
    const t = table(HOBIE, [], [HOBIE_INTERRUPT]);
    // Surgery: Hobie is P2's card under P1's control.
    const owned: GameState = {
      ...t.state,
      instances: { ...t.state.instances, [t.hobie]: { ...mustInstance(t.state, t.hobie), ownerId: P2 } },
    };
    const { state, events, session } = playFree(owned, t.deps, TAKE.card.id);
    expect(marks(state, t)).toMatchObject({ interrupt: 1, inPlay: 1, yours: 1 });
    expect(marks(state, t)["owned"] ?? 0).toBe(0);
    expect(mustPlayer(state, P1).hand).toContain(t.hobie);
    expect(mustInstance(state, t.hobie)).toMatchObject({ ownerId: P1, controllerId: P1, faceup: true });
    const resolvedAt = index(events, (e) => e.type === "abilityResolved" && e.abilityId === HOBIE_INTERRUPT.ref.id);
    const ownedAt = index(events, (e) => e.type === "ownershipChanged" && e.instanceId === t.hobie);
    expect(resolvedAt).toBeGreaterThanOrEqual(0);
    expect(ownedAt).toBeGreaterThan(resolvedAt);
    expectReplays(session, t.deps);
  });
});
