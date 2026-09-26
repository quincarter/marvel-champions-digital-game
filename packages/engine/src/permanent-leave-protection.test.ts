/**
 * docs/phase7-wave5.md §4.1 Q46: the Permanent keyword's defeat and leave-play protection is set-aware. RRG 1.8
 * "Permanent" (p. 32): "A card with the permanent keyword cannot be defeated, leave play, or have any part of its text
 * box blanked, except by card abilities in the same set (hero set, scenario set, or modular set)", equivalent to
 * "Effects on cards not from this card's set cannot defeat this card, remove this card from play, or blank any part of
 * its text box."
 *
 * The source is the card whose ability is resolving (`effects.ts` `permanentStopsLeaving`, `select.ts`
 * `ofPermanentCardsSet` over `permanentSetKeys`, §4.1 Q31/Q43). A move the game's rules make has no source card and the
 * keyword stops it as before: here a side scheme at zero threat and the Uses keyword's discard.
 *
 * Synthetic cards: permanent supports and an ally of the hero's set (the SP//dr faces' shape), a permanent side scheme
 * in the "thieves" set (Light at the End's shape, `sm` 27102), and player events of the hero's set, of the "thieves"
 * set (`specificTo`, as Taskmaster's Captive allies) and basic (in no set).
 */

import { encounterSetId, heroAspect, type AnyCard } from "@mc/content";
import { describe, expect, it } from "vitest";
import type { AbilityCost, EngineDeps } from "./abilities.js";
import { inPlayCostCandidates } from "./actions.js";
import { applyCommand, replay, startSession, type GameSession } from "./engine.js";
import type { GameEvent } from "./events.js";
import type { InstanceId } from "./ids.js";
import { mustInstance, mustPlayer } from "./query.js";
import type { EffectSpec, TargetRef } from "./spec.js";
import type { GameState } from "./state.js";
import { depsOf, stubAbility } from "./testing/abilities.js";
import { driveSession } from "./testing/drive.js";
import { stubAlly, stubEvent, stubSideScheme, stubSupport, stubTreachery } from "./testing/fixtures.js";
import { slotTargetValid } from "./resolve/target-validity.js";
import { giveCard, HERO } from "./testing/scenario.js";
import {
  copiesOf,
  encounterCardInVillainArea,
  gameAtFirstTurn,
  playerCardIntoPlay,
  playFree,
  P1,
  P2,
} from "./testing/wave3.js";

const HERO_SET = heroAspect(HERO.id);
const PERMANENT = [{ name: "permanent" }] as const;
const named = (name: string): TargetRef => ({ kind: "named", name });

// "Forced Interrupt: When this card leaves play, place 1 seen counter on the tracker." Makes a leave wait for its
// interrupt window, so the move happens in the event's apply step from the stored `LeaveRequest`.
const tracker: TargetRef = { kind: "each", query: { categories: ["support"], name: "tracker" } };
const SUIT_LEAVES = stubAbility("suit.interrupt", {
  trigger: { kind: "interrupt", forced: true, on: { on: "cardLeavesPlay", selfIs: "target" } },
  effects: [{ kind: "addCounters", target: tracker, counterType: "seen", amount: { kind: "const", value: 1 } }],
});
/** Permanent, in the hero's set. */
const SUIT = {
  ...stubSupport({ id: "suit", cost: 0, keywords: PERMANENT, abilities: [SUIT_LEAVES.ref] }),
  aspect: HERO_SET,
};
/** Not permanent: the control. */
const PLAIN = stubSupport({ id: "plain", cost: 0 });
const TRACKER = stubSupport({ id: "tracker", cost: 0 });

// "Uses (1 charge counter). Action: Remove 1 charge counter from this card." Permanent, in the hero's set.
const BATTERY_ACTION = stubAbility("battery.action", {
  trigger: { kind: "action" },
  effects: [
    { kind: "removeCounters", target: { kind: "self" }, counterType: "charge", amount: { kind: "const", value: 1 } },
  ],
});
const BATTERY = {
  ...stubSupport({
    id: "battery",
    cost: 0,
    keywords: [...PERMANENT, { name: "uses", count: 1, counterType: "charge" }],
    abilities: [BATTERY_ACTION.ref],
  }),
  aspect: HERO_SET,
};

/** Permanent, in the hero's set. */
const PARTNER = {
  ...stubAlly({ id: "partner", cost: 0, atk: 1, thw: 1, hp: 3, keywords: PERMANENT }),
  aspect: HERO_SET,
};

/** Permanent, in the "thieves" set. */
const LIGHT = stubSideScheme({ id: "light", encounterSetIds: ["thieves"], startingThreat: 3, keywords: PERMANENT });
const THIEVES = { kind: "scenario", encounterSetId: encounterSetId("thieves") } as const;

/** An event that resolves `effects` (after `cost`), of the hero's set, of the "thieves" set, or basic (in no set). */
function events(id: string, effects: readonly EffectSpec[], cost?: AbilityCost) {
  const spec = { trigger: { kind: "action" } as const, effects, ...(cost ? { cost } : {}) };
  const heroAbility = stubAbility(`hero-${id}.action`, spec);
  const thievesAbility = stubAbility(`thieves-${id}.action`, spec);
  const basicAbility = stubAbility(`basic-${id}.action`, spec);
  return {
    abilities: [heroAbility, thievesAbility, basicAbility],
    hero: stubEvent({ id: `hero-${id}`, cost: 0, aspect: HERO_SET, abilities: [heroAbility.ref] }),
    thieves: { ...stubEvent({ id: `thieves-${id}`, cost: 0, abilities: [thievesAbility.ref] }), specificTo: THIEVES },
    basic: stubEvent({ id: `basic-${id}`, cost: 0, abilities: [basicAbility.ref] }),
  };
}

// "Discard the suit and the plain support."
const DISCARD = events("discard", [
  { kind: "discardFromPlay", target: named("suit") },
  { kind: "discardFromPlay", target: named("plain") },
]);
// "Defeat the light side scheme."
const DEFEAT_SCHEME = events("defeat-scheme", [{ kind: "discardFromPlay", target: named("light"), defeated: true }]);
// "Remove 3 threat from the light side scheme."
const CLEAR_SCHEME = events("clear-scheme", [
  { kind: "removeThreat", target: named("light"), amount: { kind: "const", value: 3 } },
]);
// "Defeat the partner."
const DEFEAT_ALLY = events("defeat-ally", [{ kind: "defeat", target: named("partner") }]);

// "Take the suit into your hand."
const TAKE = events("take", [
  { kind: "takeIntoHand", cards: { kind: "ref", ref: named("suit") }, player: { kind: "controller" } },
]);

// "As an additional cost, discard a support you control. Draw 1 card." / "… discard the suit. …"
const draw: readonly EffectSpec[] = [
  { kind: "draw", player: { kind: "controller" }, amount: { kind: "const", value: 1 } },
];
const SACRIFICE_SUPPORT_PICK = { slot: "discarded", query: { categories: ["support"] }, min: 1, max: 1 } as const;
const SACRIFICE_SUPPORT = events("sacrifice-support", draw, { discardCards: SACRIFICE_SUPPORT_PICK });
const SACRIFICE_SUIT = events("sacrifice-suit", draw, {
  discardCards: { slot: "discarded", query: { categories: ["support"], name: "suit" }, min: 1, max: 1 },
});

const FILLER = stubTreachery({ id: "filler", boostIcons: 0 });
const EVENT_SETS = [DISCARD, DEFEAT_SCHEME, CLEAR_SCHEME, DEFEAT_ALLY, TAKE, SACRIFICE_SUPPORT, SACRIFICE_SUIT];

const deps: EngineDeps = depsOf(SUIT_LEAVES, BATTERY_ACTION, ...EVENT_SETS.flatMap((set) => set.abilities));
const CARDS: readonly AnyCard[] = [
  SUIT,
  PLAIN,
  TRACKER,
  BATTERY,
  PARTNER,
  LIGHT,
  FILLER,
  ...EVENT_SETS.flatMap((set) => [set.hero, set.thieves, set.basic]),
];

function start(players: 1 | 2 = 1): GameState {
  return gameAtFirstTurn({
    players,
    cards: CARDS,
    deps,
    deck: [
      SUIT.id,
      PLAIN.id,
      TRACKER.id,
      BATTERY.id,
      PARTNER.id,
      ...EVENT_SETS.flatMap((set) => [set.hero.id, set.thieves.id, set.basic.id]),
    ],
    encounter: [LIGHT.id, ...copiesOf(FILLER.id, 20)],
  });
}

/** SUIT, PLAIN and TRACKER in P1's play area. */
function supportsInPlay(): { readonly state: GameState; readonly suit: InstanceId; readonly plain: InstanceId } {
  const suit = playerCardIntoPlay(start(), SUIT.id);
  const plain = playerCardIntoPlay(suit.state, PLAIN.id);
  const withTracker = playerCardIntoPlay(plain.state, TRACKER.id);
  return { state: withTracker.state, suit: suit.id, plain: plain.id };
}

const seen = (state: GameState) => {
  const id = mustPlayer(state, P1).playArea.find((x) => state.instances[x]?.cardId === TRACKER.id);
  return id ? (mustInstance(state, id).counters.seen ?? 0) : 0;
};
const inPlay = (state: GameState, id: InstanceId) =>
  mustPlayer(state, P1).playArea.includes(id) || state.villainArea.includes(id);

function expectReplays(session: GameSession) {
  const replayed = replay(session.log, deps);
  if (!replayed.ok) throw new Error(replayed.error.message);
  expect(replayed.state).toEqual(session.state);
}

describe("§4.1 Q46 the Permanent keyword's defeat and leave-play protection (RRG 1.8 'Permanent', p. 32)", () => {
  it("an effect from another set (a basic event) cannot discard a permanent card; it discards the rest", () => {
    const { state, suit, plain } = supportsInPlay();
    const { state: after } = playFree(state, deps, DISCARD.basic.id);

    expect(inPlay(after, suit)).toBe(true);
    // No "when it leaves play" window opened: it never began to leave.
    expect(seen(after)).toBe(0);
    expect(mustPlayer(after, P1).discard).toContain(plain);
  });

  it("an effect from the permanent card's own set discards it, through its leave interrupt; replay deep-equal", () => {
    const { state, suit, plain } = supportsInPlay();
    const { session, state: after } = playFree(state, deps, DISCARD.hero.id);

    // The leave waited for its interrupt, then the stored request (with its source) moved it.
    expect(seen(after)).toBe(1);
    expect(inPlay(after, suit)).toBe(false);
    expect(mustPlayer(after, P1).discard).toEqual(expect.arrayContaining([suit, plain]));
    expectReplays(session);
  });

  it("an effect from another set cannot defeat a permanent side scheme; one from its own set defeats it", () => {
    const scheme = encounterCardInVillainArea(start(), LIGHT.id, 3);

    const basic = playFree(scheme.state, deps, DEFEAT_SCHEME.basic.id);
    expect(inPlay(basic.state, scheme.id)).toBe(true);

    const own = playFree(scheme.state, deps, DEFEAT_SCHEME.thieves.id);
    expect(inPlay(own.state, scheme.id)).toBe(false);
    expectReplays(own.session);
  });

  it("a permanent side scheme at zero threat stays, even when its own set's effect removed the threat, until an own-set effect removes it", () => {
    const scheme = encounterCardInVillainArea(start(), LIGHT.id, 3);

    // Defeat for having no threat is the game's rule, not the removing card's ability: no source card.
    const cleared = playFree(scheme.state, deps, CLEAR_SCHEME.thieves.id);
    expect(mustInstance(cleared.state, scheme.id).threat).toBe(0);
    expect(inPlay(cleared.state, scheme.id)).toBe(true);

    const basic = playFree(cleared.state, deps, DEFEAT_SCHEME.basic.id);
    expect(inPlay(basic.state, scheme.id)).toBe(true);

    const own = playFree(cleared.state, deps, DEFEAT_SCHEME.thieves.id);
    expect(inPlay(own.state, scheme.id)).toBe(false);
    expect(own.state.encounterDecks[Object.keys(own.state.encounterDecks)[0]!]!.discard).toContain(scheme.id);
    expectReplays(own.session);
  });

  it("a game-rule move with no source card is stopped as before: the Uses discard after its own ability spends the last counter", () => {
    const battery = playerCardIntoPlay(start(), BATTERY.id);
    const charged: GameState = {
      ...battery.state,
      instances: {
        ...battery.state.instances,
        [battery.id]: { ...mustInstance(battery.state, battery.id), counters: { charge: 1 } },
      },
    };
    const { session } = driveSession(startSession(charged), deps, [
      { type: "useAbility", playerId: P1, cardInstanceId: battery.id, abilityId: BATTERY_ACTION.ref.id, payment: [] },
    ]);
    const after = session.state;

    expect(mustInstance(after, battery.id).counters.charge ?? 0).toBe(0);
    expect(inPlay(after, battery.id)).toBe(true);
    expectReplays(session);
  });

  it("a 'defeat' effect from another set cannot defeat a permanent ally; one from its own set does", () => {
    const partner = playerCardIntoPlay(start(), PARTNER.id);

    const basic = playFree(partner.state, deps, DEFEAT_ALLY.basic.id);
    expect(inPlay(basic.state, partner.id)).toBe(true);

    const own = playFree(partner.state, deps, DEFEAT_ALLY.hero.id);
    expect(inPlay(own.state, partner.id)).toBe(false);
    expect(mustPlayer(own.state, P1).discard).toContain(partner.id);
    expectReplays(own.session);
  });

  it("a take-into-hand that Permanent stops changes neither the card's owner nor its controller; replay deep-equal", () => {
    const suit = playerCardIntoPlay(start(2), SUIT.id);
    // Test surgery: the suit is P2's card, under P1's control in P1's play area.
    const borrowed: GameState = {
      ...suit.state,
      instances: { ...suit.state.instances, [suit.id]: { ...mustInstance(suit.state, suit.id), ownerId: P2 } },
    };
    const { session, state: after, events } = playFree(borrowed, deps, TAKE.basic.id);

    expect(inPlay(after, suit.id)).toBe(true);
    expect(mustInstance(after, suit.id)).toMatchObject({ ownerId: P2, controllerId: P1 });
    expect(events.some((e) => e.type === "ownershipChanged")).toBe(false);
    expectReplays(session);
  });

  it("a leave or defeat that Permanent stops is logged as blocked, with the 'permanent' reason; replay deep-equal", () => {
    const { state, suit, plain } = supportsInPlay();
    const discard = playFree(state, deps, DISCARD.basic.id);
    const blocked = (events: readonly GameEvent[]) => events.filter((e) => e.type === "leavePlayBlocked");
    expect(blocked(discard.events)).toEqual([{ type: "leavePlayBlocked", instanceId: suit, reason: "permanent" }]);
    expect(blocked(discard.events).some((e) => e.instanceId === plain)).toBe(false);
    expectReplays(discard.session);

    const partner = playerCardIntoPlay(start(), PARTNER.id);
    const defeat = playFree(partner.state, deps, DEFEAT_ALLY.basic.id);
    expect(blocked(defeat.events)).toEqual([{ type: "leavePlayBlocked", instanceId: partner.id, reason: "permanent" }]);
    expectReplays(defeat.session);

    // Its own set's effect gets through: nothing blocked.
    expect(blocked(playFree(state, deps, DISCARD.hero.id).events)).toEqual([]);
  });

  it("a cost that discards a card in play cannot pick a permanent card its discard would be stopped for (RRG 1.8 'Cost', p. 13)", () => {
    const { state, suit, plain } = supportsInPlay();
    const options = (event: AnyCard) => {
      const source = giveCard(state, P1, event.id);
      return inPlayCostCandidates(source.state, deps, source.id, P1, "discard", SACRIFICE_SUPPORT_PICK);
    };
    // Any support: another set's cost leaves the suit out of the options; its own set's may take it.
    expect(options(SACRIFICE_SUPPORT.basic)).toContain(plain);
    expect(options(SACRIFICE_SUPPORT.basic)).not.toContain(suit);
    expect(options(SACRIFICE_SUPPORT.hero)).toContain(suit);

    // Only the suit will do: another set's cost cannot be paid, so its card cannot be played.
    const basic = giveCard(state, P1, SACRIFICE_SUIT.basic.id);
    const play = (cardInstanceId: InstanceId, discarded?: readonly InstanceId[]) => ({
      type: "playCard" as const,
      playerId: P1,
      cardInstanceId,
      payment: [],
      attachToInstanceId: null,
      ...(discarded ? { costChoices: { discarded } } : {}),
    });
    expect(applyCommand(basic.state, play(basic.id), deps).ok).toBe(false);
    expect(applyCommand(basic.state, play(basic.id, [suit]), deps).ok).toBe(false);

    // Its own set's cost pays with it, through its leave interrupt.
    const hero = giveCard(state, P1, SACRIFICE_SUIT.hero.id);
    const { session } = driveSession(startSession(hero.state), deps, [play(hero.id)]);
    expect(inPlay(session.state, suit)).toBe(false);
    expect(mustPlayer(session.state, P1).discard).toContain(suit);
    expect(seen(session.state)).toBe(1);
    expectReplays(session);
  });

  it("a permanent card is a valid target for a chosen discard only from its own set (RRG p. 32 target bullet)", () => {
    const { state, suit, plain } = supportsInPlay();
    // "Choose a support. Discard it." judged for each candidate, from each event's card.
    const rest: readonly EffectSpec[] = [{ kind: "discardFromPlay", target: { kind: "slot", slot: "picked" } }];
    const validFrom = (event: AnyCard, candidate: InstanceId) => {
      const source = giveCard(state, P1, event.id);
      const context = { selfInstanceId: source.id, controllerId: P1, event: null, bindings: {}, deps };
      return slotTargetValid(source.state, deps, rest, "picked", candidate, context);
    };

    expect(validFrom(DISCARD.basic, suit)).toBe(false);
    expect(validFrom(DISCARD.basic, plain)).toBe(true);
    expect(validFrom(DISCARD.hero, suit)).toBe(true);
  });
});
