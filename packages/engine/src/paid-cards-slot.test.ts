/**
 * docs/phase7-wave9.md §3.46 (b): the cards that paid for a play, as slot `paid.cards` (`PAID_CARDS_SLOT`) on the
 * play's frame and on its `cardBeingPlayed` / `cardPlayed` events, with synthetic cards. The card that needs it is
 * Spectrum (`falcon` 53018): "Response: After you play Spectrum, tuck 1 card used to pay for her under her."
 *
 * Sources: RRG 1.8 "Cost" (p. 13): "the player must pay that card's resource cost by discarding cards from their hand
 * or by using 'Resource' card abilities", and "Resources generated beyond the specified cost are considered to have
 * been overpaid for that cost and were not paid for that cost"; "Alliance" (p. 6): "any player(s) may help pay the
 * costs for that card"; "Tuck" (p. 45): "Tucked cards are not in play".
 */

import { trait } from "@mc/content";
import { describe, expect, it } from "vitest";
import type { AbilityDefinition } from "./abilities.js";
import type { Command, Payment } from "./commands.js";
import { replay, startSession } from "./engine.js";
import type { GameEvent } from "./events.js";
import type { InstanceId, PlayerId } from "./ids.js";
import { locateCard, mustInstance, mustPlayer } from "./query.js";
import type { EffectSpec } from "./spec.js";
import { PAID_CARDS_SLOT } from "./stack.js";
import type { GameState } from "./state.js";
import { depsOf, stubAbility } from "./testing/abilities.js";
import { driveSession } from "./testing/drive.js";
import { stubAlly, stubEvent, stubResource, stubSupport } from "./testing/fixtures.js";
import { defaultPick, giveCards } from "./testing/scenario.js";
import { gameAtFirstTurn, P1, P2, playerCardIntoPlay } from "./testing/wave3.js";

const def = (definition: AbilityDefinition) => definition;
const AERIAL = trait("AERIAL");
const you = { kind: "controller" } as const;
const paidCards = { kind: "slot", slot: PAID_CARDS_SLOT } as const;
const identity = { kind: "identityOf", player: you } as const;
const mark = (
  counterType: string,
  amount: EffectSpec & { kind: "addCounters" } extends { amount: infer V } ? V : never,
) => ({ kind: "addCounters", target: identity, counterType, amount }) as const;

/**
 * Writes what the slot holds onto the reader's identity as counters named `<name>.…`: how many cards, how many of them
 * have the Aerial trait, and how many [physical] and [wild] resources they print.
 */
const record = (name: string): readonly EffectSpec[] => [
  mark(`${name}.count`, { kind: "refCount", of: paidCards }),
  mark(`${name}.aerial`, { kind: "countInRef", cards: paidCards, query: { trait: AERIAL } }),
  mark(`${name}.physical`, { kind: "totalPrintedResources", cards: paidCards, types: ["physical"] }),
  mark(`${name}.wild`, { kind: "totalPrintedResources", cards: paidCards, types: ["wild"] }),
  // The play happened at all, whatever the slot holds.
  mark(`${name}.resolved`, { kind: "const", value: 1 }),
];

/** "Action: …" on an event: the played card's own ability reads the slot. */
const OWN_ACTION = stubAbility("own.action", def({ trigger: { kind: "action" }, effects: record("own") }));
/** "Forced Response: After you play a card, …" on a support: a response to the play reads it. */
const SEEN_RESPONSE = stubAbility(
  "seen.response",
  def({
    trigger: { kind: "response", forced: true, on: { on: "cardPlayed", playerIs: "controller" } },
    effects: record("seen"),
  }),
);
/** "Forced Interrupt: When you play a card, …": an interrupt to the play reads it too. */
const BEING_INTERRUPT = stubAbility(
  "being.interrupt",
  def({
    trigger: { kind: "interrupt", forced: true, on: { on: "cardBeingPlayed", playerIs: "controller" } },
    effects: record("being"),
  }),
);
/** Spectrum's shape: "Response: After you play this ally, tuck 1 card used to pay for her under her." */
const TUCK_RESPONSE = stubAbility(
  "tuck.response",
  def({
    trigger: { kind: "response", forced: false, on: { on: "cardPlayed", selfIs: "target", playerIs: "controller" } },
    effects: [
      {
        kind: "chooseCards",
        slot: "tucked",
        from: {
          kind: "zone",
          zone: "discard",
          player: { kind: "each" },
          filter: { inSlot: PAID_CARDS_SLOT },
        },
        chooser: you,
        min: 1,
        max: 1,
      },
      { kind: "tuckCards", cards: { kind: "ref", ref: { kind: "slot", slot: "tucked" } }, under: { kind: "self" } },
    ],
  }),
);
/** "Resource: Exhaust this card → generate a [wild] resource." */
const GEAR_RESOURCE = stubAbility(
  "gear.resource",
  def({ trigger: { kind: "resource" }, cost: { exhaustSelf: true }, generates: 1, effects: [] }),
);

const costing = (cost: number) => stubEvent({ id: `study-${cost}`, cost, abilities: [OWN_ACTION.ref] });
const STUDIES = [0, 1, 2, 3].map(costing);
const GROUP = stubEvent({ id: "group", cost: 2, keywords: [{ name: "alliance" }], abilities: [OWN_ACTION.ref] });
const RECRUIT = stubAlly({ id: "recruit", cost: 3, atk: 1, thw: 1, hp: 3, abilities: [TUCK_RESPONSE.ref] });
const WATCHER = stubSupport({ id: "watcher", cost: 0, abilities: [SEEN_RESPONSE.ref, BEING_INTERRUPT.ref] });
const GEAR = stubSupport({ id: "gear", cost: 0, abilities: [GEAR_RESOURCE.ref] });
/** A resource card printing 2 physical resources, with the Aerial trait. */
const WINGS = { ...stubResource({ id: "wings", icons: 0, produces: { physical: 2 } }), traits: [AERIAL] };
/** A resource card printing 1 wild resource. */
const SPARK = stubResource({ id: "spark", icons: 1 });
/** A resource card printing 1 mental resource. */
const NOTE = stubResource({ id: "note", icons: 0, produces: { mental: 1 } });

const CARDS = [...STUDIES, GROUP, RECRUIT, WATCHER, GEAR, WINGS, SPARK, NOTE];
const deps = depsOf(OWN_ACTION, SEEN_RESPONSE, BEING_INTERRUPT, TUCK_RESPONSE, GEAR_RESOURCE);

function start(players: 1 | 2 = 1): GameState {
  const state = gameAtFirstTurn({ cards: CARDS, deps, players, deck: CARDS.flatMap((c) => [c.id, c.id, c.id]) });
  return playerCardIntoPlay(state, WATCHER.id).state;
}
const fromHand = (...ids: readonly InstanceId[]): readonly Payment[] => ids.map((id) => ({ fromHand: id }));
const play = (card: InstanceId, payment: readonly Payment[], playerId: PlayerId = P1): Command => ({
  type: "playCard",
  playerId,
  cardInstanceId: card,
  payment,
  attachToInstanceId: null,
});
/** Accepts every optional trigger; picks `prefer` among a card choice when it is offered; else `defaultPick`. */
const picking =
  (prefer?: InstanceId) =>
  (state: GameState): readonly string[] => {
    const choice = state.pendingChoice;
    if (choice?.prompt.kind === "chooseTriggers") return choice.options.map((o) => o.optionId);
    const wanted = prefer && choice?.options.find((o) => o.ref?.kind === "card" && o.ref.instanceId === prefer);
    return wanted ? [wanted.optionId] : defaultPick(state);
  };
/** Runs the commands through a session; the log replays to the same state. */
function run(state: GameState, commands: readonly Command[], prefer?: InstanceId) {
  const { session, events } = driveSession(startSession(state), deps, commands, picking(prefer));
  const replayed = replay(session.log, deps);
  if (!replayed.ok) throw new Error(replayed.error.message);
  expect(replayed.state).toEqual(session.state);
  return { state: session.state, events };
}
/** The counters a reader wrote on P1's identity: [count, aerial, physical, wild], or null when it never resolved. */
function read(state: GameState, name: string): readonly number[] | null {
  const counters = mustInstance(state, mustPlayer(state, P1).identity.instanceId).counters;
  if (!counters[`${name}.resolved`]) return null;
  return ["count", "aerial", "physical", "wild"].map((key) => counters[`${name}.${key}`] ?? 0);
}
/**
 * The cards each play's `cardPlayed` announcement carried, null when it carried none. The game log's own `cardPlayed`
 * entry is unchanged by this section; the announcement is logged because the watcher hears it.
 */
const loggedPaidCards = (events: readonly GameEvent[]) =>
  events.flatMap((e) =>
    e.type === "triggerEvent" && e.phase === "resolved" && e.event.kind === "cardPlayed"
      ? [e.event.paidCards ?? null]
      : [],
  );

describe("§3.46 (b) slot `paid.cards`: the cards that paid for a play", () => {
  it("holds the cards discarded from hand, for the played card's own ability, an interrupt and a response to the play", () => {
    const given = giveCards(start(), P1, costing(3).id, WINGS.id, SPARK.id);
    const [study, wings, spark] = given.ids as [InstanceId, InstanceId, InstanceId];
    const { state, events } = run(given.state, [play(study, fromHand(wings, spark))]);
    // 2 cards; 1 Aerial; 2 printed physical; 1 printed wild.
    expect(read(state, "own")).toEqual([2, 1, 2, 1]);
    expect(read(state, "being")).toEqual([2, 1, 2, 1]);
    expect(read(state, "seen")).toEqual([2, 1, 2, 1]);
    expect(loggedPaidCards(events)).toEqual([[wings, spark]]);
    // The slot holds ids: the cards are read where they are now, in the discard pile.
    expect(mustPlayer(state, P1).discard).toEqual(expect.arrayContaining([wings, spark]));
  });

  it("holds only cards: a resource ability's resource is no card that paid, alone or beside a card", () => {
    const gear = playerCardIntoPlay(start(), GEAR.id);
    const ability: Payment = { ability: { instanceId: gear.id, abilityId: GEAR_RESOURCE.ref.id } };
    // Cost 1, paid entirely by the resource ability: the slot is not bound at all.
    const alone = giveCards(gear.state, P1, costing(1).id);
    const paidAlone = run(alone.state, [play(alone.ids[0]!, [ability])]);
    expect(read(paidAlone.state, "own")).toEqual([0, 0, 0, 0]);
    expect(read(paidAlone.state, "seen")).toEqual([0, 0, 0, 0]);
    expect(loggedPaidCards(paidAlone.events)).toEqual([null]);
    expect(mustInstance(paidAlone.state, gear.id).exhausted).toBe(true);
    // Cost 2, paid by the ability and one card: the card alone, and the exhausted support is not in it.
    const mixed = giveCards(gear.state, P1, costing(2).id, NOTE.id);
    const [study, note] = mixed.ids as [InstanceId, InstanceId];
    const paidMixed = run(mixed.state, [play(study, [ability, { fromHand: note }])]);
    expect(read(paidMixed.state, "own")).toEqual([1, 0, 0, 0]);
    expect(read(paidMixed.state, "seen")).toEqual([1, 0, 0, 0]);
    expect(loggedPaidCards(paidMixed.events)).toEqual([[note]]);
  });

  it("is empty at a cost of 0, even when a card is discarded toward it: nothing was paid", () => {
    const given = giveCards(start(), P1, costing(0).id, SPARK.id);
    const [study, spark] = given.ids as [InstanceId, InstanceId];
    const free = run(given.state, [play(study, [])]);
    expect(read(free.state, "own")).toEqual([0, 0, 0, 0]);
    expect(read(free.state, "seen")).toEqual([0, 0, 0, 0]);
    expect(loggedPaidCards(free.events)).toEqual([null]);
    // Overpaid in full (RRG 1.8 "Cost", p. 13): the discarded card generated a resource that was not paid for the cost.
    const overpaid = run(given.state, [play(study, fromHand(spark))]);
    expect(mustPlayer(overpaid.state, P1).discard).toContain(spark);
    expect(read(overpaid.state, "own")).toEqual([0, 0, 0, 0]);
    expect(loggedPaidCards(overpaid.events)).toEqual([null]);
  });

  it("leaves out a card whose every resource is overpaid, and keeps each card that could have paid", () => {
    // Cost 1 [any] paid with a mental card and a wild card: either could be the one paid, so both are in the slot.
    const given = giveCards(start(), P1, costing(1).id, NOTE.id, SPARK.id);
    const [study, note, spark] = given.ids as [InstanceId, InstanceId, InstanceId];
    const { state, events } = run(given.state, [play(study, fromHand(note, spark))]);
    expect(read(state, "own")).toEqual([2, 0, 0, 1]);
    expect(loggedPaidCards(events)).toEqual([[note, spark]]);
  });

  it("holds another player's card that helped pay for an alliance card, in that player's discard pile", () => {
    const mine = giveCards(start(2), P1, GROUP.id, SPARK.id);
    const theirs = giveCards(mine.state, P2, WINGS.id);
    const [group, spark] = mine.ids as [InstanceId, InstanceId];
    const wings = theirs.ids[0]!;
    // Cost 2: 1 wild from P1's card, 2 physical from P2's (each card has a resource that could be one of the 2 paid).
    const { state, events } = run(theirs.state, [play(group, fromHand(spark, wings))]);
    expect(read(state, "own")).toEqual([2, 1, 2, 1]);
    expect(read(state, "seen")).toEqual([2, 1, 2, 1]);
    expect(loggedPaidCards(events)).toEqual([[spark, wings]]);
    expect(mustPlayer(state, P2).discard).toContain(wings);
    expect(mustPlayer(state, P1).discard).toContain(spark);
  });

  it("an ally tucks 1 card used to pay for it: the chosen card leaves the discard pile and is under the ally", () => {
    const given = giveCards(start(), P1, RECRUIT.id, WINGS.id, SPARK.id);
    const [recruit, wings, spark] = given.ids as [InstanceId, InstanceId, InstanceId];
    const { state } = run(given.state, [play(recruit, fromHand(wings, spark))], spark);
    expect(mustInstance(state, recruit).tucked).toEqual([spark]);
    expect(locateCard(state, spark)).toMatchObject({ kind: "tucked", hostInstanceId: recruit });
    expect(mustPlayer(state, P1).discard).toContain(wings);
    expect(mustPlayer(state, P1).discard).not.toContain(spark);
    // The other card instead.
    const other = run(given.state, [play(recruit, fromHand(wings, spark))], wings);
    expect(mustInstance(other.state, recruit).tucked).toEqual([wings]);
  });

  it("an ally paid for by a resource ability alone has no card to tuck", () => {
    const gears = [playerCardIntoPlay(start(), GEAR.id)];
    gears.push(playerCardIntoPlay(gears[0]!.state, GEAR.id));
    gears.push(playerCardIntoPlay(gears[1]!.state, GEAR.id));
    const given = giveCards(gears[2]!.state, P1, RECRUIT.id);
    const recruit = given.ids[0]!;
    const payment: Payment[] = gears.map((g) => ({ ability: { instanceId: g.id, abilityId: GEAR_RESOURCE.ref.id } }));
    const { state, events } = run(given.state, [play(recruit, payment)]);
    expect(locateCard(state, recruit)).toMatchObject({ kind: "playArea" });
    expect(mustInstance(state, recruit).tucked ?? []).toEqual([]);
    expect(loggedPaidCards(events)).toEqual([null]);
  });
});
