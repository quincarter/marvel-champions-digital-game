/**
 * "When a player card would be placed into a discard pile from play, … shuffle that card into its owner's deck
 * instead." (Pinpoint, `ironheart` 29035): a replacement on the generic `cardLeavesPlay` leaving, not on a defeat. The
 * primitive is the composition the engine already has — an interrupt on `cardLeavesPlay` with `eventIs: { to:
 * "discard" }` (a player's discard pile, where only player cards go: RRG 1.8 "Discard", p. 16) and
 * `replaceTriggeringEvent` moving `eventTarget` (RRG 1.8 "Replacement Effect", p. 37) — and these tests pin that every
 * route from play to a player's discard pile waits for it: a discard effect, a move to the discard pile, a defeat, and
 * an attachment leaving with its host (docs/phase7-wave5.md §4.1 Q17, Q32–Q34). A leaving for somewhere else (a hand)
 * and an encounter card's discard (the encounter discard pile) do not match.
 */

import { cardId } from "@mc/content";
import { describe, expect, it } from "vitest";
import type { EngineDeps } from "./abilities.js";
import { replay, type GameSession } from "./engine.js";
import type { GameEvent } from "./events.js";
import type { InstanceId } from "./ids.js";
import { mustInstance, mustPlayer } from "./query.js";
import type { EffectSpec, TargetRef } from "./spec.js";
import type { GameState } from "./state.js";
import { depsOf, stubAbility } from "./testing/abilities.js";
import { stubAlly, stubEvent, stubMinion, stubSupport, stubUpgrade } from "./testing/fixtures.js";
import { copiesOf, gameAtFirstTurn, minionEngagedWith, P1, playerCardIntoPlay, playFree } from "./testing/wave3.js";
import { TREACHERY } from "./testing/scenario.js";

const KEEPER_ID = "keeper.replacement";
/** "Forced Interrupt: When a player card would be placed into a discard pile from play, shuffle it into its owner's deck instead." */
const KEEPER_REPLACEMENT = stubAbility(KEEPER_ID, {
  trigger: { kind: "interrupt", forced: true, on: { on: "cardLeavesPlay", eventIs: { to: "discard" } } },
  effects: [
    {
      kind: "replaceTriggeringEvent",
      with: [{ kind: "moveCards", cards: { kind: "ref", ref: { kind: "eventTarget" } }, to: "deckShuffle" }],
    },
  ],
});
const KEEPER = stubSupport({ id: "keeper", cost: 0, abilities: [KEEPER_REPLACEMENT.ref] });
const BUDDY = stubAlly({ id: "buddy", cost: 0, atk: 1, thw: 1, hp: 3 });
const GIZMO = stubUpgrade({ id: "gizmo", cost: 0 });
const GRUNT = stubMinion({ id: "grunt", atk: 1, sch: 1, hp: 3 });

const ref = (name: string): TargetRef => ({ kind: "each", query: { name } });
const event = (id: string, effects: readonly EffectSpec[]) => {
  const ability = stubAbility(`${id}.action`, { trigger: { kind: "action" }, effects });
  return { card: stubEvent({ id, cost: 0, abilities: [ability.ref] }), ability };
};
const DISCARD_BUDDY = event("discard-buddy", [{ kind: "discardFromPlay", target: ref("buddy") }]);
const MOVE_BUDDY_TO_DISCARD = event("move-buddy", [
  { kind: "moveCards", cards: { kind: "ref", ref: ref("buddy") }, to: "discard" },
]);
const SMASH_BUDDY = event("smash-buddy", [
  { kind: "dealDamage", target: ref("buddy"), amount: { kind: "const", value: 5 } },
]);
const TAKE_BUDDY = event("take-buddy", [
  { kind: "takeIntoHand", cards: { kind: "ref", ref: ref("buddy") }, player: { kind: "controller" } },
]);
const DISCARD_GRUNT = event("discard-grunt", [{ kind: "discardFromPlay", target: ref("grunt") }]);
const EVENTS = [DISCARD_BUDDY, MOVE_BUDDY_TO_DISCARD, SMASH_BUDDY, TAKE_BUDDY, DISCARD_GRUNT];

interface Table {
  readonly state: GameState;
  readonly deps: EngineDeps;
  readonly buddy: InstanceId;
  readonly gizmo: InstanceId;
  readonly grunt: InstanceId;
}

/** The keeper support and Buddy in play, the Gizmo upgrade attached to Buddy, and an encounter minion engaged with P1. */
function table(): Table {
  const deps = depsOf(KEEPER_REPLACEMENT, ...EVENTS.map((e) => e.ability));
  const start = gameAtFirstTurn({
    cards: [KEEPER, BUDDY, GIZMO, GRUNT, ...EVENTS.map((e) => e.card)],
    deps,
    deck: [KEEPER.id, BUDDY.id, GIZMO.id, ...EVENTS.map((e) => e.card.id)],
    encounter: [...copiesOf(TREACHERY.id, 20), GRUNT.id],
  });
  const keeper = playerCardIntoPlay(start, KEEPER.id);
  const buddy = playerCardIntoPlay(keeper.state, BUDDY.id);
  const gizmo = playerCardIntoPlay(buddy.state, GIZMO.id);
  const grunt = minionEngagedWith(gizmo.state, cardId("grunt"));
  const s = grunt.state;
  // Surgery: the Gizmo attached to Buddy.
  const state: GameState = {
    ...s,
    players: s.players.map((p) =>
      p.playerId === P1 ? { ...p, playArea: p.playArea.filter((id) => id !== gizmo.id) } : p,
    ),
    instances: {
      ...s.instances,
      [gizmo.id]: { ...mustInstance(s, gizmo.id), attachedTo: buddy.id },
      [buddy.id]: { ...mustInstance(s, buddy.id), attachments: [gizmo.id] },
    },
  };
  return { state, deps, buddy: buddy.id, gizmo: gizmo.id, grunt: grunt.id };
}

const deckOf = (state: GameState) => mustPlayer(state, P1).deck;
const discardOf = (state: GameState) => mustPlayer(state, P1).discard;
const replaced = (events: readonly GameEvent[]) =>
  events.filter((e) => e.type === "abilityResolved" && e.abilityId === KEEPER_ID).length;
const expectReplays = (session: GameSession, deps: EngineDeps) => {
  const replayed = replay(session.log, deps);
  if (!replayed.ok) throw new Error(replayed.error.message);
  expect(replayed.state).toEqual(session.state);
};

/** P1's deck before `played` was handed over to be played (`playFree` takes it from the deck when not in hand). */
const deckWithout = (state: GameState, played: string) =>
  deckOf(state).filter((id) => mustInstance(state, id).cardId !== cardId(played));

/** Each of `ids` went from play to P1's deck, which was shuffled, and not to the discard pile: the deck gained exactly these. */
function expectShuffledIn(
  before: GameState,
  played: string,
  after: GameState,
  events: readonly GameEvent[],
  ids: InstanceId[],
) {
  expect([...deckOf(after)].sort()).toEqual([...deckWithout(before, played), ...ids].sort());
  for (const id of ids) {
    expect(deckOf(after)).toContain(id);
    expect(discardOf(after)).not.toContain(id);
  }
  expect(events.some((e) => e.type === "deckShuffled" && e.zone.kind === "deck" && e.zone.playerId === P1)).toBe(true);
}

describe("a replacement for 'a player card would be placed into a discard pile from play'", () => {
  it("a discard effect: the ally is shuffled into its owner's deck, and its attachment is replaced too", () => {
    const t = table();
    const { state, events, session } = playFree(t.state, t.deps, DISCARD_BUDDY.card.id);
    // Buddy's own leaving and the Gizmo's (leaving with its host, §4.1 Q32) both heard the replacement.
    expect(replaced(events)).toBe(2);
    expectShuffledIn(t.state, DISCARD_BUDDY.card.id, state, events, [t.buddy, t.gizmo]);
    expect(events.some((e) => e.type === "cardDiscardedFromPlay" && e.instanceId === t.buddy)).toBe(false);
    expect(state.stack).toEqual([]);
    expectReplays(session, t.deps);
  });

  it("a move to the discard pile goes through the same path", () => {
    const t = table();
    const { state, events, session } = playFree(t.state, t.deps, MOVE_BUDDY_TO_DISCARD.card.id);
    expectShuffledIn(t.state, MOVE_BUDDY_TO_DISCARD.card.id, state, events, [t.buddy, t.gizmo]);
    expectReplays(session, t.deps);
  });

  it("a defeat: the ally is still defeated, only its discard is replaced", () => {
    const t = table();
    const { state, events, session } = playFree(t.state, t.deps, SMASH_BUDDY.card.id);
    expect(
      events.some(
        (e) =>
          e.type === "triggerEvent" &&
          e.phase === "resolved" &&
          e.event.kind === "characterDefeated" &&
          e.event.instanceId === t.buddy,
      ),
    ).toBe(true);
    expectShuffledIn(t.state, SMASH_BUDDY.card.id, state, events, [t.buddy, t.gizmo]);
    // It left play fresh: no damage on it in the deck (RRG 1.8 "Leaves Play", p. 27).
    expect(mustInstance(state, t.buddy).damage).toBe(0);
    expectReplays(session, t.deps);
  });

  it("an attachment discarded with a host that goes elsewhere: only the attachment is replaced", () => {
    const t = table();
    const { state, events, session } = playFree(t.state, t.deps, TAKE_BUDDY.card.id);
    expect(replaced(events)).toBe(1);
    expect(mustPlayer(state, P1).hand).toContain(t.buddy);
    expectShuffledIn(t.state, TAKE_BUDDY.card.id, state, events, [t.gizmo]);
    expectReplays(session, t.deps);
  });

  it("an encounter card going to the encounter discard pile is not a player card being discarded", () => {
    const t = table();
    const { state, events } = playFree(t.state, t.deps, DISCARD_GRUNT.card.id);
    expect(replaced(events)).toBe(0);
    const offered = events.some(
      (e) => e.type === "windowOpened" && e.candidates.some((c) => `${c.abilityId}` === KEEPER_ID),
    );
    expect(offered).toBe(false);
    expect(Object.values(state.encounterDecks).some((piles) => piles.discard.includes(t.grunt))).toBe(true);
    expect([...deckOf(state)].sort()).toEqual([...deckWithout(t.state, DISCARD_GRUNT.card.id)].sort());
  });
});
