/**
 * docs/phase7-wave8.md §3.51: "If you paid for this event with a resource card" (Concussive Blast `aoa` 45007, Command
 * Authority 45008). The payment records `paid.cards.<cardType>` and `Predicate paidWithCard { cardType, of? }` reads
 * it. Proven with synthetic cards driving real `playCard` / `useAbility` commands.
 *
 * Sources: RRG 1.8 "Cost" (p. 13: resources come "by discarding cards from their hand or by using 'Resource' card
 * abilities"; "Resources generated beyond the specified cost are considered to have been overpaid for that cost and
 * were not paid for that cost"), "Resource Card" (p. 37); FAQ "Unstoppable Force (#6)" (p. 60: at a cost of 0 nothing
 * was paid). Owner decision §4.1 Q28 = A.
 *
 * The probe event deals 1 damage to the villain, 10 more if it was paid for with a resource card, and 1000 more if
 * it was paid for with an event card, so the villain's damage names what the payment recorded.
 */

import { flat, type CardId } from "@mc/content";
import { describe, expect, it } from "vitest";
import type { EngineDeps } from "./abilities.js";
import type { Command, Payment } from "./commands.js";
import { replay } from "./engine.js";
import { playerId, type InstanceId } from "./ids.js";
import { mustInstance } from "./query.js";
import { canBePaidFor, EMPTY_POOL, requirementOf } from "./resources.js";
import { createGame } from "./setup.js";
import type { EffectSpec, Predicate, TargetRef } from "./spec.js";
import type { GameState } from "./state.js";
import { depsOf, stubAbility } from "./testing/abilities.js";
import { runCommands } from "./testing/drive.js";
import {
  stubEvent,
  stubMainScheme,
  stubResource,
  stubSupport,
  stubTreachery,
  stubUpgrade,
  stubVillain,
} from "./testing/fixtures.js";
import { DEFAULT_CARDS, DEFAULT_DECK, giveCard, giveCards, HERO, seatIdentities } from "./testing/scenario.js";

const p1 = playerId("p1");
const eventTarget: TargetRef = { kind: "eventTarget" };
const villainRef: TargetRef = { kind: "villain" };
const copies = (id: CardId, n: number): readonly CardId[] => Array.from({ length: n }, () => id);

const BLANK = stubTreachery({ id: "blank", boostIcons: 0 });
const QUIET_VILLAIN = stubVillain({ id: "quiet", stages: [{ hp: flat(9000), atk: 0, sch: 0 }] });
const LONG_SCHEME = stubMainScheme({
  id: "long",
  stages: [{ startingThreat: flat(0), targetThreat: flat(99), acceleration: flat(0) }],
});

const damage = (value: number): EffectSpec => ({
  kind: "dealDamage",
  target: villainRef,
  amount: { kind: "const", value },
});
const ifThen = (condition: Predicate, value: number): EffectSpec => ({
  kind: "if",
  condition,
  then: [damage(value)],
});
const WITH_RESOURCE_CARD: Predicate = { kind: "paidWithCard", cardType: "resource" };
const WITH_EVENT_CARD: Predicate = { kind: "paidWithCard", cardType: "event" };

/** 1 damage; "if you paid for this event with a resource card", 10 more; with an event card, 1000 more. */
const PROBE = stubAbility("probe.action", {
  trigger: { kind: "action" },
  effects: [damage(1), ifThen(WITH_RESOURCE_CARD, 10), ifThen(WITH_EVENT_CARD, 1000)],
});
const ZERO = stubEvent({ id: "probe-0", cost: 0, abilities: [PROBE.ref] });
const ONE = stubEvent({ id: "probe-1", cost: 1, abilities: [PROBE.ref] });
const TWO = stubEvent({ id: "probe-2", cost: 2, abilities: [PROBE.ref] });
/** The same probe at a cost of 0 with "spend a [physical] resource" as its ability's cost: a typed slot. */
const TYPED_PROBE = stubAbility("typed-probe.action", {
  trigger: { kind: "action" },
  cost: { resources: { physical: 1 } },
  effects: [damage(1), ifThen(WITH_RESOURCE_CARD, 10), ifThen(WITH_EVENT_CARD, 1000)],
});
const TYPED = stubEvent({ id: "probe-typed", cost: 0, abilities: [TYPED_PROBE.ref] });

/** Resource cards: one [energy], and a double ([mental][mental]). */
const ENERGY = stubResource({ id: "energy-card", icons: 1, produces: { energy: 1 } });
const DOUBLE = stubResource({ id: "double-card", icons: 2, produces: { mental: 2 } });
/** Cards that are not resource cards: an event with one [physical], and one with two. */
const PLAIN = stubEvent({ id: "plain-card", cost: 9, resourceIcons: { physical: 1 } });
const PLAIN_DOUBLE = stubEvent({ id: "plain-double", cost: 9, resourceIcons: { physical: 2 } });

/** "Resource: Exhaust this card → generate a [wild] resource": a resource ability, not a resource card. */
const BATTERY_RESOURCE = stubAbility("battery.resource", {
  trigger: { kind: "resource" },
  cost: { exhaustSelf: true },
  generates: { wild: 1 },
  effects: [],
});
const BATTERY = stubSupport({ id: "battery", cost: 0, abilities: [BATTERY_RESOURCE.ref] });
const BATTERY_TWO = stubSupport({ id: "battery-two", cost: 0, abilities: [BATTERY_RESOURCE.ref] });

/** "Reduce the cost to play each event by 1." */
const REDUCER_RULE = stubAbility("reducer.constant", {
  trigger: { kind: "constant", costModifiers: [{ delta: -1, appliesTo: { categories: ["event"] } }] },
  effects: [],
});
const REDUCER = stubSupport({ id: "reducer", cost: 0, abilities: [REDUCER_RULE.ref] });

/** Another card's interrupt to the play: 20 damage if its condition holds. */
const watcher = (id: string, condition: Predicate) =>
  stubAbility(`${id}.interrupt`, {
    trigger: {
      kind: "interrupt",
      forced: true,
      on: { on: "cardBeingPlayed", playerIs: "controller", targetIs: { categories: ["event"] } },
    },
    effects: [ifThen(condition, 20)],
  });
/** "… if you paid for **that event** with a resource card": the play in progress, named by `of`. */
const WATCHER_OF = watcher("watcher-of", { kind: "paidWithCard", cardType: "resource", of: eventTarget });
const WATCHER_OF_CARD = stubUpgrade({ id: "watcher-of", cost: 0, abilities: [WATCHER_OF.ref] });
/** Without `of`: the interrupt's own frame, which paid for nothing. */
const WATCHER_OWN = watcher("watcher-own", WITH_RESOURCE_CARD);
const WATCHER_OWN_CARD = stubUpgrade({ id: "watcher-own", cost: 0, abilities: [WATCHER_OWN.ref] });

/** "Action: Spend 1 resource → 1 damage; if you paid with a resource card, 10 more": an ability's own payment. */
const GADGET_ACTION = stubAbility("gadget.action", {
  trigger: { kind: "action" },
  cost: { resources: 1 },
  effects: [damage(1), ifThen(WITH_RESOURCE_CARD, 10)],
});
const GADGET = stubSupport({ id: "gadget", cost: 0, abilities: [GADGET_ACTION.ref] });

const deps: EngineDeps = depsOf(
  PROBE,
  TYPED_PROBE,
  BATTERY_RESOURCE,
  REDUCER_RULE,
  WATCHER_OF,
  WATCHER_OWN,
  GADGET_ACTION,
);
const PLAYER_CARDS = [
  ZERO,
  ONE,
  TWO,
  TYPED,
  ENERGY,
  DOUBLE,
  PLAIN,
  PLAIN_DOUBLE,
  BATTERY,
  BATTERY_TWO,
  REDUCER,
  WATCHER_OF_CARD,
  WATCHER_OWN_CARD,
  GADGET,
];
/** Two of each paying card, so a payment can spend two of a kind. */
const PLAYER_DECK = [...PLAYER_CARDS.map((c) => c.id), ENERGY.id, PLAIN.id, ONE.id];

function game(): GameState {
  const identities = seatIdentities(HERO, 1);
  const result = createGame(
    {
      seed: 4,
      cards: [...DEFAULT_CARDS, QUIET_VILLAIN, LONG_SCHEME, BLANK, ...PLAYER_CARDS, ...identities],
      villainCardId: QUIET_VILLAIN.id,
      mainSchemeCardId: LONG_SCHEME.id,
      encounterDeck: copies(BLANK.id, 16),
      includeIdentitySets: false,
      players: identities.map((identity) => ({
        identityCardId: identity.id,
        deck: [...DEFAULT_DECK, ...PLAYER_DECK],
      })),
    },
    deps,
  );
  if (!result.ok) throw new Error(result.error.message);
  return runCommands(result.state, deps).state;
}

const fromHand = (...ids: readonly InstanceId[]): readonly Payment[] => ids.map((id) => ({ fromHand: id }));
const playCard = (id: InstanceId, payment: readonly Payment[] = []): Command => ({
  type: "playCard",
  playerId: p1,
  cardInstanceId: id,
  payment,
  attachToInstanceId: null,
});
const villainDamage = (state: GameState): number =>
  mustInstance(state, state.villains[0]?.instanceId as InstanceId).damage;

/** Puts each of `cards` (cost 0) into play, in order. */
function withInPlay(start: GameState, ...cards: readonly CardId[]): { state: GameState; ids: readonly InstanceId[] } {
  let state = start;
  const ids: InstanceId[] = [];
  for (const card of cards) {
    const given = giveCard(state, p1, card, ids);
    state = runCommands(given.state, deps, playCard(given.id)).state;
    ids.push(given.id);
  }
  return { state, ids };
}

/** Plays `event` paid for by discarding one card of each of `payWith`; the damage on the villain afterwards. */
function playPaying(event: CardId, payWith: readonly CardId[], inPlay: readonly CardId[] = []): number {
  const board = withInPlay(game(), ...inPlay);
  const given = giveCards(board.state, p1, event, ...payWith);
  const [eventId, ...payment] = given.ids as [InstanceId, ...InstanceId[]];
  const played = runCommands(given.state, deps, playCard(eventId, fromHand(...payment))).state;
  // Every paying card left the hand: the payment was accepted whole, overpaid cards included.
  const discard = played.players[0]?.discard ?? [];
  for (const id of payment) expect(discard).toContain(id);
  return villainDamage(played);
}

describe("§3.51 paidWithCard: the card types a payment discarded", () => {
  it("cost 1 paid with a resource card only: true", () => {
    expect(playPaying(ONE.id, [ENERGY.id])).toBe(11);
  });

  it("cost 1 paid with a card that is not a resource card: false (and it reads as paid with an event card)", () => {
    expect(playPaying(ONE.id, [PLAIN.id])).toBe(1001);
  });

  it("cost 2 paid with a resource card and another card, both needed: true", () => {
    expect(playPaying(TWO.id, [ENERGY.id, PLAIN.id])).toBe(1011);
  });

  it("cost 2 paid with two cards that are not resource cards: false", () => {
    expect(playPaying(TWO.id, [PLAIN.id, PLAIN.id])).toBe(1001);
  });

  it("cost 2 paid with one double resource card: true", () => {
    expect(playPaying(TWO.id, [DOUBLE.id])).toBe(11);
  });

  it("a double resource card against a cost of 1: one of its resources is paid, the other overpaid: true", () => {
    expect(playPaying(ONE.id, [DOUBLE.id])).toBe(11);
  });
});

describe("§3.51 with §4.1 Q28 = A: overpaid resources were not paid (RRG 1.8 'Cost', p. 13)", () => {
  it("cost 0, a resource card discarded anyway: nothing was paid, false", () => {
    expect(playPaying(ZERO.id, [ENERGY.id])).toBe(1);
  });

  it("cost 1 reduced to 0 by another card, a resource card discarded anyway: false", () => {
    expect(playPaying(ONE.id, [ENERGY.id], [REDUCER.id])).toBe(1);
  });

  it("cost 2 reduced to 1, paid with a resource card: the cost is still at least 1, true", () => {
    expect(playPaying(TWO.id, [ENERGY.id], [REDUCER.id])).toBe(11);
  });

  it("cost 1 overpaid with a resource card and another card of 1: either can be the one paid, so both read true", () => {
    // The rules do not say which resource is the overpaid one; the resource card's can be the one paid.
    expect(playPaying(ONE.id, [ENERGY.id, PLAIN.id])).toBe(1011);
  });

  it("cost 2 overpaid, the other card covering it alone: the resource card's resource can still be one of the two", () => {
    // [physical][physical] and [energy] toward 2: [energy] with one [physical] is a paying set.
    expect(playPaying(TWO.id, [PLAIN_DOUBLE.id, ENERGY.id])).toBe(1011);
  });

  it("a typed cost the resource card cannot go toward: it is overpaid in every reading, false", () => {
    // "Spend a [physical] resource": the [energy] of the resource card fills no slot; the event card's [physical] does.
    expect(playPaying(TYPED.id, [ENERGY.id, PLAIN.id])).toBe(1001);
  });

  it("canBePaidFor: the slot arithmetic", () => {
    const energy = { ...EMPTY_POOL, energy: 1 };
    const wild = { ...EMPTY_POOL, wild: 1 };
    const both = { ...EMPTY_POOL, energy: 1, physical: 1 };
    expect(canBePaidFor(energy, energy, requirementOf(1))).toBe(true);
    expect(canBePaidFor(energy, energy, requirementOf(0))).toBe(false);
    expect(canBePaidFor(both, energy, requirementOf(1))).toBe(true);
    expect(canBePaidFor(both, energy, requirementOf({ physical: 1 }))).toBe(false);
    expect(canBePaidFor(both, energy, requirementOf({ physical: 1, generic: 1 }))).toBe(true);
    expect(canBePaidFor({ ...both, wild: 1 }, wild, requirementOf({ physical: 1 }))).toBe(true);
    // A wild slot takes only a wild (RRG 1.8 "Wild Resource", p. 48).
    expect(canBePaidFor({ ...both, wild: 1 }, energy, requirementOf({ wild: 1 }))).toBe(false);
    expect(canBePaidFor({ ...both, wild: 1 }, wild, requirementOf({ wild: 1 }))).toBe(true);
    // A card that generated nothing paid nothing.
    expect(canBePaidFor(both, EMPTY_POOL, requirementOf(1))).toBe(false);
    // The rest of the pool must still pay the rest: [energy] in the generic slot leaves [physical] unpaid.
    expect(canBePaidFor({ ...EMPTY_POOL, energy: 2 }, energy, requirementOf({ physical: 1, generic: 1 }))).toBe(false);
  });
});

describe("§3.51 a resource ability is not a resource card (RRG 1.8 'Cost', p. 13)", () => {
  /** Plays `event` with the resource abilities of `supports` (in play) and one card of each of `payWith`. */
  function playWithAbilities(event: CardId, supports: readonly CardId[], payWith: readonly CardId[]): number {
    const board = withInPlay(game(), ...supports);
    const given = giveCards(board.state, p1, event, ...payWith);
    const [eventId, ...hand] = given.ids as [InstanceId, ...InstanceId[]];
    const payment: readonly Payment[] = [
      ...board.ids.map((instanceId) => ({ ability: { instanceId, abilityId: BATTERY_RESOURCE.ref.id } })),
      ...fromHand(...hand),
    ];
    const played = runCommands(given.state, deps, playCard(eventId, payment)).state;
    for (const id of board.ids) expect(mustInstance(played, id).exhausted).toBe(true);
    return villainDamage(played);
  }

  it("cost 1 paid with a resource generated by a card in play: false", () => {
    expect(playWithAbilities(ONE.id, [BATTERY.id], [])).toBe(1);
  });

  it("cost 2 paid with a resource ability's [wild] and a card that is not a resource card: false", () => {
    expect(playWithAbilities(TWO.id, [BATTERY.id], [PLAIN.id])).toBe(1001);
  });

  it("cost 2 paid with two resource abilities: false", () => {
    expect(playWithAbilities(TWO.id, [BATTERY.id, BATTERY_TWO.id], [])).toBe(1);
  });

  it("cost 2 paid with a resource ability and a resource card: true, for the card", () => {
    expect(playWithAbilities(TWO.id, [BATTERY.id], [ENERGY.id])).toBe(11);
  });
});

describe("§3.51 where the record is read", () => {
  it("another card's interrupt reads the play in progress through `of`", () => {
    // The event's own 1 + 10, and the interrupt's 20.
    expect(playPaying(ONE.id, [ENERGY.id], [WATCHER_OF_CARD.id])).toBe(31);
    expect(playPaying(ONE.id, [PLAIN.id], [WATCHER_OF_CARD.id])).toBe(1001);
  });

  it("without `of`, another card's frame has no payment of its own: false", () => {
    expect(playPaying(ONE.id, [ENERGY.id], [WATCHER_OWN_CARD.id])).toBe(11);
  });

  it("a play's record ends with the play: the next event, paid with another card, reads only its own payment", () => {
    const given = giveCards(game(), p1, ONE.id, ENERGY.id, ONE.id, PLAIN.id, ZERO.id);
    const [first, energy, second, plain, zero] = given.ids as [
      InstanceId,
      InstanceId,
      InstanceId,
      InstanceId,
      InstanceId,
    ];
    const afterFirst = runCommands(given.state, deps, playCard(first, fromHand(energy))).state;
    expect(villainDamage(afterFirst)).toBe(11);
    const afterSecond = runCommands(afterFirst, deps, playCard(second, fromHand(plain))).state;
    expect(villainDamage(afterSecond)).toBe(11 + 1001);
    const afterThird = runCommands(afterSecond, deps, playCard(zero)).state;
    expect(villainDamage(afterThird)).toBe(11 + 1001 + 1);
  });

  it("an ability's own resource cost records its payment the same way", () => {
    const useGadget = (payWith: CardId): number => {
      const board = withInPlay(game(), GADGET.id);
      const given = giveCard(board.state, p1, payWith);
      const used = runCommands(given.state, deps, {
        type: "useAbility",
        playerId: p1,
        cardInstanceId: board.ids[0] as InstanceId,
        abilityId: GADGET_ACTION.ref.id,
        payment: fromHand(given.id),
      }).state;
      return villainDamage(used);
    };
    expect(useGadget(ENERGY.id)).toBe(11);
    expect(useGadget(PLAIN.id)).toBe(1);
  });
});

describe("§3.51 replay", () => {
  it("the same command list replays deep-equal", () => {
    const board = withInPlay(game(), BATTERY.id, WATCHER_OF_CARD.id);
    const given = giveCards(board.state, p1, TWO.id, ENERGY.id, ONE.id, DOUBLE.id);
    const [two, energy, one, double] = given.ids as [InstanceId, InstanceId, InstanceId, InstanceId];
    const battery = { ability: { instanceId: board.ids[0] as InstanceId, abilityId: BATTERY_RESOURCE.ref.id } };
    const run = runCommands(
      given.state,
      deps,
      playCard(two, [battery, ...fromHand(energy)]),
      playCard(one, fromHand(double)),
    );
    // Each play: 1 + 10 for the resource card, and the interrupt's 20.
    expect(villainDamage(run.state)).toBe(62);
    const replayed = replay(run.session.log, deps);
    if (!replayed.ok) throw new Error(replayed.error.message);
    expect(replayed.state).toEqual(run.session.state);
  });
});
