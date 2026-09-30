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

import { flat } from "@mc/content";
import { describe, expect, it } from "vitest";
import type { AbilityDefinition, EngineDeps } from "./abilities.js";
import { replay, startSession, type GameSession } from "./engine.js";
import type { GameEvent } from "./events.js";
import type { InstanceId } from "./ids.js";
import { mustInstance, mustPlayer } from "./query.js";
import type { EffectSpec, TargetRef, ValueSpec } from "./spec.js";
import type { GameState } from "./state.js";
import { depsOf, stubAbility, type StubAbility } from "./testing/abilities.js";
import { stubAlly, stubEvent, stubSupport, stubUpgrade, stubVillain } from "./testing/fixtures.js";
import { createGame } from "./setup.js";
import { driveSession } from "./testing/drive.js";
import {
  DEFAULT_CARDS,
  DEFAULT_DECK,
  defaultPick,
  giveCard,
  HERO,
  MAIN_SCHEME,
  seatIdentities,
  TREACHERY,
} from "./testing/scenario.js";
import { copiesOf, gameAtFirstTurn, P1, P2, playerCardIntoPlay, playFree } from "./testing/wave3.js";

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
const villainInPlay: ValueSpec = { kind: "count", query: { categories: ["villain"] } };
const gadgetOnVillain: ValueSpec = {
  kind: "count",
  query: { categories: ["villain"], hasAttachment: { name: "gadget" } },
};
/** "Interrupt: When [this upgrade] leaves play, …": records whether its host is still in play with it attached. */
const GADGET_INTERRUPT = stubAbility("gadget.interrupt", {
  trigger: { kind: "interrupt", forced: true, on: { on: "cardLeavesPlay", selfIs: "target" } },
  effects: [
    mark("gadgetInterrupt", { kind: "const", value: 1 }),
    mark("gadgetSeesHobie", hobieInPlay),
    mark("gadgetOnHobie", gadgetOnHobie),
    mark("gadgetSeesVillain", villainInPlay),
    mark("gadgetOnVillain", gadgetOnVillain),
  ],
});
const LISTENING_GADGET = stubUpgrade({ id: "gadget", cost: 0, abilities: [GADGET_INTERRUPT.ref] });
/** "Forced Interrupt: When [this upgrade] would leave play, return it to your hand instead." */
const GADGET_SAVE = stubAbility("gadget.save", {
  trigger: { kind: "interrupt", forced: true, on: { on: "cardLeavesPlay", selfIs: "target" } },
  effects: [
    {
      kind: "replaceTriggeringEvent",
      with: [
        mark("saved", { kind: "const", value: 1 }),
        { kind: "moveCards", cards: { kind: "ref", ref: { kind: "eventTarget" } }, to: "hand" },
      ],
    },
  ],
});
const SAVING_GADGET = stubUpgrade({ id: "gadget", cost: 0, abilities: [GADGET_SAVE.ref] });
/** "Forced Interrupt: When an ally would leave play, cancel that." */
const KEEP_ALLY = stubAbility("tracker.keep-ally", {
  trigger: { kind: "interrupt", forced: true, on: { on: "cardLeavesPlay", targetIs: { categories: ["ally"] } } },
  effects: [mark("kept", { kind: "const", value: 1 }), { kind: "cancelTriggeringEvent" }],
});
/** "Forced Response: After a card leaves play, …" (any card). */
const ANY_RESPONSE = stubAbility("tracker.any-response", {
  trigger: { kind: "response", forced: true, on: { on: "cardLeavesPlay" } },
  effects: [mark("anyResponse", { kind: "const", value: 1 })],
});

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
const SET_VILLAIN_ASIDE = event("set-villain-aside", [{ kind: "setVillainAside", villain: { kind: "villain" } }]);
const TAKE = event("take", [
  { kind: "takeIntoHand", cards: { kind: "ref", ref: hobieRef }, player: { kind: "controller" } },
]);
/** Played events that do not send Hobie to the discard pile. */
const OTHER_EVENTS = [TAKE, SET_VILLAIN_ASIDE];
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

/**
 * Hobie in play with 2 web counters and the gadget attached, and the tracker support. `onVillain`: the gadget is
 * attached to the villain instead.
 */
function table(
  ally: typeof HOBIE,
  trackerAbilities: readonly StubAbility[],
  abilities: readonly StubAbility[],
  gadgetCard: typeof GADGET = GADGET,
  onVillain = false,
): Table {
  const TRACKER = trackerWith(...trackerAbilities);
  const deps = depsOf(...abilities, ...trackerAbilities, ...ALL_EVENTS.map((e) => e.ability));
  const start = gameAtFirstTurn({
    cards: [ally, gadgetCard, TRACKER, ...ALL_EVENTS.map((e) => e.card)],
    deps,
    deck: [ally.id, gadgetCard.id, TRACKER.id, ...ALL_EVENTS.map((e) => e.card.id)],
  });
  const tracker = playerCardIntoPlay(start, TRACKER.id);
  const hobie = playerCardIntoPlay(tracker.state, ally.id);
  const gadget = playerCardIntoPlay(hobie.state, gadgetCard.id);
  const s = gadget.state;
  const host = onVillain ? s.activeVillainId : hobie.id;
  // Surgery: the gadget attached to Hobie (or the villain), and 2 web counters on him.
  const state: GameState = {
    ...s,
    players: s.players.map((p) =>
      p.playerId === P1 ? { ...p, playArea: p.playArea.filter((id) => id !== gadget.id) } : p,
    ),
    instances: {
      ...s.instances,
      [gadget.id]: { ...mustInstance(s, gadget.id), attachedTo: host },
      [hobie.id]: { ...mustInstance(s, hobie.id), counters: { web: 2 } },
      [host]: {
        ...mustInstance(s, host),
        ...(host === hobie.id ? { counters: { web: 2 } } : {}),
        attachments: [gadget.id],
      },
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
/** The windows opened for `cardLeavesPlay` at `timing`, each as its candidates' ability ids. */
const leaveWindows = (events: readonly GameEvent[], timing: "interrupt" | "response") =>
  events.flatMap((e) =>
    e.type === "windowOpened" && e.timing === timing && e.event.kind === "cardLeavesPlay"
      ? [e.candidates.map((c) => `${c.abilityId}`)]
      : [],
  );

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

describe("§4.1 Q32 attachments leaving with their host get their interrupts in the host's window", () => {
  it("the attachment's interrupt shares the host's window, both still in play; one response window after", () => {
    const t = table(HOBIE, [ANY_RESPONSE], [HOBIE_INTERRUPT, GADGET_INTERRUPT], LISTENING_GADGET);
    const { state, events, session } = playFree(t.state, t.deps, MOVE_TO_DISCARD.card.id);
    expect(marks(state, t)).toMatchObject({
      interrupt: 1,
      inPlay: 1,
      attached: 1,
      gadgetInterrupt: 1,
      gadgetSeesHobie: 1,
      gadgetOnHobie: 1,
      anyResponse: 2,
    });
    // One interrupt window for both; two forced interrupts, ordered by the first player (RRG 1.8 pp. 5, 40).
    const interrupts = leaveWindows(events, "interrupt");
    expect(interrupts).toHaveLength(1);
    expect([...interrupts[0]!].sort()).toEqual([GADGET_INTERRUPT.ref.id, HOBIE_INTERRUPT.ref.id].sort());
    const ordered = events.flatMap((e) => (e.type === "choiceRequested" ? [e.choice] : []));
    expect(ordered[0]).toMatchObject({ playerId: state.firstPlayerId, prompt: { kind: "orderTriggers" } });
    // Both interrupts resolved before either card moved.
    const lastInterrupt = Math.max(
      index(events, (e) => e.type === "abilityResolved" && e.abilityId === HOBIE_INTERRUPT.ref.id),
      index(events, (e) => e.type === "abilityResolved" && e.abilityId === GADGET_INTERRUPT.ref.id),
    );
    const firstDiscard = index(
      events,
      (e) => e.type === "cardDiscardedFromPlay" && (e.instanceId === t.hobie || e.instanceId === t.gadget),
    );
    expect(lastInterrupt).toBeLessThan(firstDiscard);
    // One response window: the ally's leaving and the attachment's, each where it went.
    expect(leaveWindows(events, "response")).toEqual([[ANY_RESPONSE.ref.id, ANY_RESPONSE.ref.id]]);
    const resolved = events.flatMap((e) =>
      e.type === "triggerEvent" && e.phase === "resolved" && e.event.kind === "cardLeavesPlay"
        ? [[e.event.instanceId, e.event.to]]
        : [],
    );
    expect(resolved).toEqual([
      [t.hobie, "discard"],
      [t.gadget, "discard"],
    ]);
    expect(inDiscard(state, t.hobie)).toBe(true);
    expect(inDiscard(state, t.gadget)).toBe(true);
    expect(state.stack).toEqual([]);
    expect(state.pendingLeftPlay).toBeUndefined();
    expectReplays(session, t.deps);
  });

  it("the host's leaving cancelled first: it stays, so the attachment's interrupt does not resolve", () => {
    const t = table(PLAIN, [KEEP_ALLY, ANY_RESPONSE], [GADGET_INTERRUPT], LISTENING_GADGET);
    const given = giveCard(t.state, P1, DISCARD_EFFECT.card.id);
    // The first player puts the cancel first.
    const keepFirst = (state: GameState) => {
      const choice = state.pendingChoice;
      if (choice?.prompt.kind !== "orderTriggers") return defaultPick(state);
      const ids = choice.options.map((o) => o.optionId);
      const keep = (id: string) => id.includes(KEEP_ALLY.ref.id);
      return [...ids.filter(keep), ...ids.filter((id) => !keep(id))];
    };
    const { session, events } = driveSession(
      startSession(given.state),
      t.deps,
      [{ type: "playCard", playerId: P1, cardInstanceId: given.id, payment: [], attachToInstanceId: null }],
      keepFirst,
    );
    const state = session.state;
    expect(marks(state, t)).toMatchObject({ kept: 1 });
    expect(marks(state, t)["gadgetInterrupt"] ?? 0).toBe(0);
    expect(marks(state, t)["anyResponse"] ?? 0).toBe(0);
    expect(mustInstance(state, t.hobie).attachments).toEqual([t.gadget]);
    expect(inDiscard(state, t.hobie)).toBe(false);
    expect(events.some((e) => e.type === "abilityResolved" && e.abilityId === GADGET_INTERRUPT.ref.id)).toBe(false);
    expect(state.stack).toEqual([]);
    expectReplays(session, t.deps);
  });

  it("an interrupt on the attachment alone makes the host wait too", () => {
    const t = table(PLAIN, [], [GADGET_INTERRUPT], LISTENING_GADGET);
    const { state, events, session } = playFree(t.state, t.deps, DISCARD_EFFECT.card.id);
    expect(marks(state, t)).toMatchObject({ gadgetInterrupt: 1, gadgetSeesHobie: 1, gadgetOnHobie: 1 });
    expect(leaveWindows(events, "interrupt")).toEqual([[GADGET_INTERRUPT.ref.id]]);
    expect(inDiscard(state, t.hobie)).toBe(true);
    expect(inDiscard(state, t.gadget)).toBe(true);
    expect(state.stack).toEqual([]);
    expectReplays(session, t.deps);
  });

  it("a villain set aside: its attachment's interrupt resolves first, with the villain still in play", () => {
    const t = table(PLAIN, [ANY_RESPONSE], [GADGET_INTERRUPT], LISTENING_GADGET, true);
    const { state, events, session } = playFree(t.state, t.deps, SET_VILLAIN_ASIDE.card.id);
    expect(marks(state, t)).toMatchObject({
      gadgetInterrupt: 1,
      gadgetSeesVillain: 1,
      gadgetOnVillain: 1,
      anyResponse: 1,
    });
    const resolvedAt = index(events, (e) => e.type === "abilityResolved" && e.abilityId === GADGET_INTERRUPT.ref.id);
    const asideAt = index(events, (e) => e.type === "villainSetAside");
    expect(resolvedAt).toBeGreaterThanOrEqual(0);
    expect(resolvedAt).toBeLessThan(asideAt);
    expect(inDiscard(state, t.gadget)).toBe(true);
    expect(state.encounterSetAside).toContain(state.villains[0]!.instanceId);
    expect(state.stack).toEqual([]);
    expectReplays(session, t.deps);
  });

  it("a villain's last stage defeated while another villain remains: the attachment joins the defeat's window", () => {
    const V1 = stubVillain({ id: "v1", stages: [{ hp: flat(5), atk: 0, sch: 0 }] });
    const V2 = stubVillain({ id: "v2", stages: [{ hp: flat(5), atk: 0, sch: 0 }] });
    const TRACKER = trackerWith(ANY_RESPONSE);
    const SLAY = event("slay-villain", [
      { kind: "dealDamage", target: { kind: "villain" }, amount: { kind: "const", value: 5 } },
    ]);
    const deps = depsOf(GADGET_INTERRUPT, ANY_RESPONSE, SLAY.ability);
    const identities = seatIdentities(HERO, 1);
    const created = createGame(
      {
        seed: 3,
        cards: [...DEFAULT_CARDS, ...identities, V1, V2, MAIN_SCHEME, TREACHERY, LISTENING_GADGET, TRACKER, SLAY.card],
        villainCardId: V1.id,
        villains: [
          { villainCardId: V1.id, encounterDeck: [] },
          { villainCardId: V2.id, encounterDeck: [] },
        ],
        sharedEncounterDeck: true,
        mainSchemeCardId: MAIN_SCHEME.id,
        encounterDeck: copiesOf(TREACHERY.id, 20),
        players: identities.map((identity) => ({
          identityCardId: identity.id,
          deck: [...DEFAULT_DECK, LISTENING_GADGET.id, TRACKER.id, SLAY.card.id],
        })),
      },
      deps,
    );
    if (!created.ok) throw new Error(created.error.message);
    const start = driveSession(startSession(created.state), deps).session.state;
    const tracker = playerCardIntoPlay(start, TRACKER.id);
    const gadget = playerCardIntoPlay(tracker.state, LISTENING_GADGET.id);
    const s0 = gadget.state;
    const v1 = s0.villains.find((v) => v.cardId === V1.id)!.instanceId;
    // Surgery: the gadget attached to V1, the active villain.
    const table: GameState = {
      ...s0,
      activeVillainId: v1,
      players: s0.players.map((p) =>
        p.playerId === P1 ? { ...p, playArea: p.playArea.filter((id) => id !== gadget.id) } : p,
      ),
      instances: {
        ...s0.instances,
        [gadget.id]: { ...mustInstance(s0, gadget.id), attachedTo: v1 },
        [v1]: { ...mustInstance(s0, v1), attachments: [gadget.id] },
      },
    };
    const { state, events, session } = playFree(table, deps, SLAY.card.id);
    const counters = mustInstance(state, tracker.id).counters;
    expect(counters).toMatchObject({ gadgetInterrupt: 1, gadgetSeesVillain: 2, gadgetOnVillain: 1, anyResponse: 1 });
    // The gadget's interrupt is in the defeat's own window, before the villain falls.
    const interrupts = events.flatMap((e) =>
      e.type === "windowOpened" && e.timing === "interrupt" ? [e.event.kind] : [],
    );
    expect(interrupts).toEqual(["characterDefeated"]);
    const resolvedAt = index(events, (e) => e.type === "abilityResolved" && e.abilityId === GADGET_INTERRUPT.ref.id);
    const defeatedAt = index(events, (e) => e.type === "characterDefeated" && e.instanceId === v1);
    expect(resolvedAt).toBeGreaterThanOrEqual(0);
    expect(resolvedAt).toBeLessThan(defeatedAt);
    expect(mustPlayer(state, P1).discard).toContain(gadget.id);
    expect(state.villains.find((v) => v.instanceId === v1)?.defeated).toBe(true);
    expect(state.stack).toEqual([]);
    expectReplays(session, deps);
  });

  it("an attachment's own leaving replaced: the villain is still set aside, the attachment goes where it was sent", () => {
    const t = table(PLAIN, [ANY_RESPONSE], [GADGET_SAVE], SAVING_GADGET, true);
    const { state, events, session } = playFree(t.state, t.deps, SET_VILLAIN_ASIDE.card.id);
    expect(marks(state, t)).toMatchObject({ saved: 1, anyResponse: 1 });
    expect(mustPlayer(state, P1).hand).toContain(t.gadget);
    expect(state.encounterSetAside).toContain(state.villains[0]!.instanceId);
    const leavings = events.flatMap((e) =>
      e.type === "triggerEvent" && e.event.kind === "cardLeavesPlay" ? [`${e.phase}:${e.event.to}`] : [],
    );
    expect(leavings).toEqual(["initiated:discard", "cancelled:discard", "resolved:hand"]);
    expect(state.stack).toEqual([]);
    expectReplays(session, t.deps);
  });

  it("with nothing listening, a villain set aside logs nothing new", () => {
    const t = table(PLAIN, [], [], GADGET, true);
    const { state, events } = playFree(t.state, t.deps, SET_VILLAIN_ASIDE.card.id);
    expect(inDiscard(state, t.gadget)).toBe(true);
    expect(JSON.stringify(events)).not.toContain("cardLeavesPlay");
  });
});

describe("§4.1 Q33 cards leaving from one effect share one interrupt window", () => {
  /** Two copies of Hobie in play, each with his forced interrupt, and the tracker. */
  function twoHobies(trackerAbilities: readonly StubAbility[]) {
    const TRACKER = trackerWith(...trackerAbilities);
    const deps = depsOf(HOBIE_INTERRUPT, ...trackerAbilities, ...ALL_EVENTS.map((e) => e.ability));
    const start = gameAtFirstTurn({
      cards: [HOBIE, TRACKER, ...ALL_EVENTS.map((e) => e.card)],
      deps,
      deck: [HOBIE.id, HOBIE.id, TRACKER.id, ...ALL_EVENTS.map((e) => e.card.id)],
    });
    const tracker = playerCardIntoPlay(start, TRACKER.id);
    const first = playerCardIntoPlay(tracker.state, HOBIE.id);
    const second = playerCardIntoPlay(first.state, HOBIE.id);
    return { state: second.state, deps, first: first.id, second: second.id, tracker: tracker.id };
  }
  /** Answers an order prompt with `first`'s interrupt first, anything else by default. */
  const putting = (first: InstanceId) => (state: GameState) => {
    const choice = state.pendingChoice;
    if (choice?.prompt.kind !== "orderTriggers") return defaultPick(state);
    const ids = choice.options.map((o) => o.optionId);
    return [...ids.filter((id) => id.startsWith(`${first}:`)), ...ids.filter((id) => !id.startsWith(`${first}:`))];
  };

  for (const which of ["first", "second"] as const) {
    it(`both interrupts see both cards in play, the ${which} copy's first as the first player chose; one response window`, () => {
      const t = twoHobies([TRACKER_RESPONSE]);
      const given = giveCard(t.state, P1, DISCARD_EFFECT.card.id);
      const leading = which === "first" ? t.first : t.second;
      const { session, events } = driveSession(
        startSession(given.state),
        t.deps,
        [{ type: "playCard", playerId: P1, cardInstanceId: given.id, payment: [], attachToInstanceId: null }],
        putting(leading),
      );
      const state = session.state;
      // Each interrupt counted both copies still in play: 2 + 2.
      expect(mustInstance(state, t.tracker).counters).toMatchObject({ interrupt: 2, inPlay: 4, response: 2 });
      expect(leaveWindows(events, "interrupt")).toEqual([[HOBIE_INTERRUPT.ref.id, HOBIE_INTERRUPT.ref.id]]);
      const orders = events.flatMap((e) =>
        e.type === "choiceRequested" && e.choice.prompt.kind === "orderTriggers" ? [e.choice] : [],
      );
      expect(orders[0]).toMatchObject({ playerId: state.firstPlayerId, authority: "firstPlayerOrders" });
      const resolvedBy = events.flatMap((e) =>
        e.type === "abilityResolved" && e.abilityId === HOBIE_INTERRUPT.ref.id ? [e.instanceId] : [],
      );
      expect(resolvedBy).toEqual(which === "first" ? [t.first, t.second] : [t.second, t.first]);
      // Then both moved, in the order asked, and one response window heard both.
      const discarded = events.flatMap((e) => (e.type === "cardDiscardedFromPlay" ? [e.instanceId] : []));
      expect(discarded.filter((id) => id === t.first || id === t.second)).toEqual([t.first, t.second]);
      expect(leaveWindows(events, "response")).toEqual([[TRACKER_RESPONSE.ref.id, TRACKER_RESPONSE.ref.id]]);
      expect(state.stack).toEqual([]);
      expectReplays(session, t.deps);
    });
  }
});

describe("§4.1 Q34 a replacement's move is announced after the replaced leaving's 'cancelled' line", () => {
  it("cancelled, then the tuck's announcement", () => {
    const t = table(PLAIN, [REPLACEMENT, TRACKER_RESPONSE], []);
    const { state, events, session } = playFree(t.state, t.deps, MOVE_TO_DISCARD.card.id);
    const leavings = events.flatMap((e) =>
      e.type === "triggerEvent" && e.event.kind === "cardLeavesPlay" && e.event.instanceId === t.hobie
        ? [`${e.phase}:${e.event.to}`]
        : [],
    );
    expect(leavings).toEqual(["initiated:discard", "cancelled:discard", "resolved:tucked"]);
    const cancelledAt = index(events, (e) => e.type === "triggerEvent" && e.phase === "cancelled");
    const tuckAnnounced = index(
      events,
      (e) => e.type === "triggerEvent" && e.event.kind === "cardLeavesPlay" && e.event.to === "tucked",
    );
    expect(cancelledAt).toBeLessThan(tuckAnnounced);
    expect(marks(state, t)).toMatchObject({ replaced: 1, response: 1 });
    expect(state.stack).toEqual([]);
    expectReplays(session, t.deps);
  });
});
