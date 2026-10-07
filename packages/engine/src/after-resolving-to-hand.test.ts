/**
 * docs/phase7-wave7.md §3.68: a played event returned to hand after it resolves (`EffectSpec afterResolving`, the
 * `afterResolving` destination on a `playCard` frame). Synthetic cards; the printed shape it serves is "Response: After
 * you spend this card to pay for an AERIAL event, return that event to your hand after resolving its effects."
 *
 * Sources: RRG 1.8 "Initiating Abilities" (p. 24): step 5 "Pay the cost(s)" comes before step 7 "if it is an event
 * card, its effects resolve and it is then placed in its owner's discard pile", so the payment's response resolves
 * while the event has yet to resolve and can only mark its play. "Event" (p. 18): the player "resolves its effects
 * (unless those effects are canceled), and then places the card in its owner's discard pile after those effects
 * resolve (or are canceled)". "Delayed Effect" (p. 16): an effect at a future timing point resolves "before responses
 * to that point or condition may be used". "Cancel" (p. 11): "If the effects of an event card are canceled, the card is
 * still considered played, and it is discarded."
 */

import { trait, type CardId } from "@mc/content";
import { describe, expect, it } from "vitest";
import type { AbilityDefinition } from "./abilities.js";
import type { Command, Payment } from "./commands.js";
import { applyCommand, replay, startSession } from "./engine.js";
import type { GameEvent } from "./events.js";
import type { InstanceId, PlayerId } from "./ids.js";
import { locateCard, mustInstance, mustPlayer } from "./query.js";
import type { EffectSpec } from "./spec.js";
import type { GameState } from "./state.js";
import { depsOf, stubAbility } from "./testing/abilities.js";
import { driveSession } from "./testing/drive.js";
import { stubEvent, stubResource, stubSupport, stubUpgrade } from "./testing/fixtures.js";
import { defaultPick, giveCards } from "./testing/scenario.js";
import { gameAtFirstTurn, P1, P2, playerCardIntoPlay } from "./testing/wave3.js";

const def = (definition: AbilityDefinition) => definition;
const AERIAL = trait("AERIAL");
const hitVillain = (n: number): EffectSpec => ({
  kind: "dealDamage",
  target: { kind: "villain" },
  amount: { kind: "const", value: n },
});

/** "Response: After you spend this card to pay for an AERIAL event, return that event to your hand after resolving its effects." */
const ANATOMY_RESPONSE = stubAbility(
  "anatomy.response",
  def({
    trigger: {
      kind: "response",
      forced: false,
      on: {
        on: "resourcesSpent",
        selfIs: "source",
        playerIs: "controller",
        targetIs: { categories: ["event"], trait: AERIAL },
        eventIs: { purpose: "playCard" },
      },
    },
    effects: [{ kind: "afterResolving", card: { kind: "eventTarget" }, to: "hand" }],
  }),
);
const ANATOMY = stubResource({ id: "anatomy", icons: 1, abilities: [ANATOMY_RESPONSE.ref] });
const PLAIN = stubResource({ id: "plain", icons: 1 });

/** "Resource: Exhaust this card → generate a [wild] resource. Return the card paid for to its owner's hand after it resolves." */
const PERCH_RESOURCE = stubAbility(
  "perch.resource",
  def({
    trigger: { kind: "resource" },
    cost: { exhaustSelf: true },
    generates: 1,
    effects: [{ kind: "afterResolving", card: { kind: "slot", slot: "paidFor" }, to: "hand" }],
  }),
);
const PERCH = stubSupport({ id: "perch", cost: 0, abilities: [PERCH_RESOURCE.ref] });

const SWOOP_ACTION = stubAbility("swoop.action", def({ trigger: { kind: "action" }, effects: [hitVillain(2)] }));
const SWOOP = { ...stubEvent({ id: "swoop", cost: 1, abilities: [SWOOP_ACTION.ref] }), traits: [AERIAL] };
/** The same event with alliance, so another player can help pay for it. */
const DIVE = {
  ...stubEvent({ id: "dive", cost: 2, keywords: [{ name: "alliance" }], abilities: [SWOOP_ACTION.ref] }),
  traits: [AERIAL],
};
/** Not AERIAL. */
const WALK = stubEvent({ id: "walk", cost: 1, abilities: [SWOOP_ACTION.ref] });
/** "Deal 1 damage to the villain. Remove this card from the game." */
const VANISH_ACTION = stubAbility(
  "vanish.action",
  def({
    trigger: { kind: "action" },
    effects: [
      hitVillain(1),
      { kind: "moveCards", cards: { kind: "ref", ref: { kind: "self" } }, to: "removedFromGame" },
    ],
  }),
);
const VANISH = { ...stubEvent({ id: "vanish", cost: 1, abilities: [VANISH_ACTION.ref] }), traits: [AERIAL] };
/** An AERIAL support: paid for, but not an event. */
const GLIDER = { ...stubSupport({ id: "glider", cost: 1 }), traits: [AERIAL] };

/** "Forced Interrupt: When you play an event, cancel its effects and discard it. Then, discard this card." */
const COUNTER_INTERRUPT = stubAbility(
  "counter.interrupt",
  def({
    trigger: {
      kind: "interrupt",
      forced: true,
      on: { on: "cardBeingPlayed", playerIs: "controller", targetIs: { categories: ["event"] } },
    },
    effects: [{ kind: "cancelTriggeringEvent" }, { kind: "discardFromPlay", target: { kind: "self" } }],
  }),
);
const COUNTER = stubUpgrade({ id: "counter", cost: 0, abilities: [COUNTER_INTERRUPT.ref] });
/** "Forced Response: After you play a card, draw 1 card." — proof the card was still played. */
const WATCHER_RESPONSE = stubAbility(
  "watcher.response",
  def({
    trigger: { kind: "response", forced: true, on: { on: "cardPlayed", playerIs: "controller" } },
    effects: [{ kind: "draw", player: { kind: "controller" }, amount: { kind: "const", value: 1 } }],
  }),
);
const WATCHER = stubSupport({ id: "watcher", cost: 0, abilities: [WATCHER_RESPONSE.ref] });

const CARDS = [ANATOMY, PLAIN, PERCH, SWOOP, DIVE, WALK, VANISH, GLIDER, COUNTER, WATCHER];
const deps = depsOf(ANATOMY_RESPONSE, PERCH_RESOURCE, SWOOP_ACTION, VANISH_ACTION, COUNTER_INTERRUPT, WATCHER_RESPONSE);
const DECK: readonly CardId[] = CARDS.flatMap((card) => [card.id, card.id]);

const start = (players: 1 | 2 = 1): GameState => gameAtFirstTurn({ cards: CARDS, deps, players, deck: DECK });
const fromHand = (...ids: readonly InstanceId[]): readonly Payment[] => ids.map((id) => ({ fromHand: id }));
const play = (card: InstanceId, payment: readonly Payment[], playerId: PlayerId = P1): Command => ({
  type: "playCard",
  playerId,
  cardInstanceId: card,
  payment,
  attachToInstanceId: null,
});
/** Accepts every optional trigger offered (or none, with `use: false`); everything else as `defaultPick`. */
const picker =
  (use: boolean) =>
  (state: GameState): readonly string[] => {
    if (state.pendingChoice?.prompt.kind !== "chooseTriggers") return defaultPick(state);
    return use ? state.pendingChoice.options.map((o) => o.optionId) : [];
  };
/** Drives `commands`, and checks that replaying the session's log reaches the same state. */
function run(state: GameState, use: boolean, ...commands: readonly Command[]) {
  const driven = driveSession(startSession(state), deps, commands, picker(use));
  const replayed = replay(driven.session.log, deps);
  if (!replayed.ok) throw new Error(replayed.error.message);
  expect(replayed.state).toEqual(driven.session.state);
  return { state: driven.session.state, events: driven.events };
}

const villainDamage = (state: GameState) => mustInstance(state, state.villains[0]?.instanceId as InstanceId).damage;
const index = (events: readonly GameEvent[], test: (e: GameEvent) => boolean) => events.findIndex(test);
const movesOf = (events: readonly GameEvent[], id: InstanceId) =>
  events.flatMap((e) => (e.type === "cardMoved" && e.instanceId === id ? [`${e.from.kind}>${e.to.kind}`] : []));
const offered = (events: readonly GameEvent[], ability: string) =>
  events.some((e) => e.type === "windowOpened" && e.candidates.some((c) => c.abilityId === ability));
const returns = (events: readonly GameEvent[]) => events.filter((e) => e.type === "playedEventReturned");
const marks = (events: readonly GameEvent[]) => events.filter((e) => e.type === "playDestinationSet");

describe("§3.68 a played event returned to hand after it resolves", () => {
  it("the event resolves fully, then goes to its owner's hand and never to the discard pile; the spent card is discarded", () => {
    const given = giveCards(start(), P1, SWOOP.id, ANATOMY.id);
    const [swoop, anatomy] = given.ids as [InstanceId, InstanceId];
    const { state, events } = run(given.state, true, play(swoop, fromHand(anatomy)));

    expect(villainDamage(state)).toBe(2);
    expect(mustPlayer(state, P1).hand).toContain(swoop);
    expect(mustPlayer(state, P1).discard).not.toContain(swoop);
    expect(mustPlayer(state, P1).discard).toContain(anatomy);
    expect(state.stack).toEqual([]);

    // The log: marked while paying, returned once the damage is dealt, and no move to a discard pile.
    expect(marks(events)).toEqual([{ type: "playDestinationSet", instanceId: swoop, to: "hand" }]);
    expect(returns(events)).toEqual([{ type: "playedEventReturned", instanceId: swoop, playerId: P1 }]);
    expect(movesOf(events, swoop)).toEqual(["hand>resolving", "resolving>hand"]);
    const marked = index(events, (e) => e.type === "playDestinationSet");
    const damaged = index(events, (e) => e.type === "damageDealt");
    const returned = index(events, (e) => e.type === "playedEventReturned");
    expect(marked).toBeGreaterThanOrEqual(0);
    expect(marked).toBeLessThan(damaged);
    expect(damaged).toBeLessThan(returned);
  });

  it("without the response the event is discarded as before, with nothing about a return in the log", () => {
    const given = giveCards(start(), P1, SWOOP.id, ANATOMY.id);
    const [swoop, anatomy] = given.ids as [InstanceId, InstanceId];
    const declined = run(given.state, false, play(swoop, fromHand(anatomy)));
    expect(offered(declined.events, ANATOMY_RESPONSE.ref.id)).toBe(true);
    expect(villainDamage(declined.state)).toBe(2);
    expect(mustPlayer(declined.state, P1).discard).toEqual(expect.arrayContaining([swoop, anatomy]));
    expect(movesOf(declined.events, swoop)).toEqual(["hand>resolving", "resolving>discard"]);
    expect([...marks(declined.events), ...returns(declined.events)]).toEqual([]);

    // Paid for with a card that has no such response: nothing is offered at all.
    const plain = giveCards(start(), P1, SWOOP.id, PLAIN.id);
    const [swoop2, res] = plain.ids as [InstanceId, InstanceId];
    const paid = run(plain.state, true, play(swoop2, fromHand(res)));
    expect(offered(paid.events, ANATOMY_RESPONSE.ref.id)).toBe(false);
    expect(mustPlayer(paid.state, P1).discard).toContain(swoop2);
  });

  it("the trait filter: an event without the trait, or a card that is not an event, is not answered", () => {
    const walked = giveCards(start(), P1, WALK.id, ANATOMY.id);
    const [walk, anatomy] = walked.ids as [InstanceId, InstanceId];
    const first = run(walked.state, true, play(walk, fromHand(anatomy)));
    expect(offered(first.events, ANATOMY_RESPONSE.ref.id)).toBe(false);
    expect(mustPlayer(first.state, P1).discard).toContain(walk);

    const glided = giveCards(start(), P1, GLIDER.id, ANATOMY.id);
    const [glider, anatomy2] = glided.ids as [InstanceId, InstanceId];
    const second = run(glided.state, true, play(glider, fromHand(anatomy2)));
    expect(offered(second.events, ANATOMY_RESPONSE.ref.id)).toBe(false);
    expect(mustPlayer(second.state, P1).playArea).toContain(glider);
  });

  it("the event was still played: 'after you play a card' is answered after the return, with the event already in hand", () => {
    const watched = playerCardIntoPlay(start(), WATCHER.id);
    const given = giveCards(watched.state, P1, SWOOP.id, ANATOMY.id);
    const [swoop, anatomy] = given.ids as [InstanceId, InstanceId];
    const { state, events } = run(given.state, true, play(swoop, fromHand(anatomy)));
    const returned = index(events, (e) => e.type === "playedEventReturned");
    const window = index(
      events,
      (e) => e.type === "windowOpened" && e.event.kind === "cardPlayed" && e.event.instanceId === swoop,
    );
    const watcher = index(events, (e) => e.type === "abilityResolved" && e.abilityId === WATCHER_RESPONSE.ref.id);
    expect(returned).toBeGreaterThanOrEqual(0);
    expect(returned).toBeLessThan(window);
    expect(window).toBeLessThan(watcher);
    expect(mustPlayer(state, P1).hand).toContain(swoop);
  });

  it("the returned event can be played again the same turn: discarded when paid for plainly, returned again by a second copy", () => {
    const given = giveCards(start(), P1, SWOOP.id, ANATOMY.id, PLAIN.id, ANATOMY.id);
    const [swoop, anatomy, plain, anatomy2] = given.ids as [InstanceId, InstanceId, InstanceId, InstanceId];
    const once = run(given.state, true, play(swoop, fromHand(anatomy)));
    expect(mustPlayer(once.state, P1).hand).toContain(swoop);

    // The first play's destination ended with that play: a plain payment discards the event.
    const plainly = run(once.state, true, play(swoop, fromHand(plain)));
    expect(villainDamage(plainly.state)).toBe(4);
    expect(mustPlayer(plainly.state, P1).discard).toContain(swoop);
    expect(marks(plainly.events)).toEqual([]);

    const again = run(once.state, true, play(swoop, fromHand(anatomy2)));
    expect(villainDamage(again.state)).toBe(4);
    expect(mustPlayer(again.state, P1).hand).toContain(swoop);
    expect(returns(again.events)).toHaveLength(1);
  });

  it("two copies spent on one event return it once", () => {
    const given = giveCards(start(2), P1, DIVE.id, ANATOMY.id, ANATOMY.id);
    const [dive, a, b] = given.ids as [InstanceId, InstanceId, InstanceId];
    const { state, events } = run(given.state, true, play(dive, fromHand(a, b)));
    expect(events.filter((e) => e.type === "abilityResolved" && e.abilityId === ANATOMY_RESPONSE.ref.id)).toHaveLength(
      2,
    );
    expect(marks(events)).toHaveLength(1);
    expect(returns(events)).toHaveLength(1);
    expect(mustPlayer(state, P1).hand.filter((id) => id === dive)).toEqual([dive]);
    expect(mustPlayer(state, P1).discard).toEqual(expect.arrayContaining([a, b]));
  });

  it("an event its own text removed from the game stays there: the response was usable, and nothing is returned", () => {
    const given = giveCards(start(), P1, VANISH.id, ANATOMY.id);
    const [vanish, anatomy] = given.ids as [InstanceId, InstanceId];
    const { state, events } = run(given.state, true, play(vanish, fromHand(anatomy)));
    // Where the event will be is not known while paying, so the response is offered and marks the play.
    expect(marks(events)).toEqual([{ type: "playDestinationSet", instanceId: vanish, to: "hand" }]);
    expect(villainDamage(state)).toBe(1);
    expect(locateCard(state, vanish)?.kind).toBe("removedFromGame");
    expect(mustPlayer(state, P1).hand).not.toContain(vanish);
    expect(mustPlayer(state, P1).discard).not.toContain(vanish);
    expect(returns(events)).toEqual([]);
  });

  it("a canceled event is discarded, not returned: its effects never resolved (RRG 1.8 'Cancel', p. 11)", () => {
    const watched = playerCardIntoPlay(start(), WATCHER.id);
    const countered = playerCardIntoPlay(watched.state, COUNTER.id);
    const given = giveCards(countered.state, P1, SWOOP.id, ANATOMY.id);
    const [swoop, anatomy] = given.ids as [InstanceId, InstanceId];
    const { state, events } = run(given.state, true, play(swoop, fromHand(anatomy)));
    // Paid and answered before the cancel (step 5 before step 6), so the play was marked.
    expect(marks(events)).toHaveLength(1);
    expect(villainDamage(state)).toBe(0);
    expect(mustPlayer(state, P1).discard).toEqual(expect.arrayContaining([swoop, anatomy]));
    expect(mustPlayer(state, P1).hand).not.toContain(swoop);
    expect(movesOf(events, swoop)).toEqual(["hand>resolving", "resolving>discard"]);
    expect(returns(events)).toEqual([]);
    // Still considered played.
    expect(events.some((e) => e.type === "abilityResolved" && e.abilityId === WATCHER_RESPONSE.ref.id)).toBe(true);
  });

  it("'after YOU spend this card': another player's copy in hand is not offered for an event it did not pay for", () => {
    const mine = giveCards(start(2), P1, SWOOP.id, PLAIN.id);
    const theirs = giveCards(mine.state, P2, ANATOMY.id);
    const [swoop, plain] = mine.ids as [InstanceId, InstanceId];
    const { state, events } = run(theirs.state, true, play(swoop, fromHand(plain)));
    expect(offered(events, ANATOMY_RESPONSE.ref.id)).toBe(false);
    expect(mustPlayer(state, P1).discard).toContain(swoop);
    expect(mustPlayer(state, P2).hand).toContain(theirs.ids[0]);
  });

  it("a helper's copy spent on another player's alliance event returns the event to its owner's hand (RRG 1.8 p. 31)", () => {
    const mine = giveCards(start(2), P1, DIVE.id, PLAIN.id);
    const theirs = giveCards(mine.state, P2, ANATOMY.id);
    const [dive, plain] = mine.ids as [InstanceId, InstanceId];
    const [anatomy] = theirs.ids as [InstanceId];
    const { state, events } = run(theirs.state, true, play(dive, fromHand(plain, anatomy)));
    expect(villainDamage(state)).toBe(2);
    expect(returns(events)).toEqual([{ type: "playedEventReturned", instanceId: dive, playerId: P1 }]);
    expect(mustPlayer(state, P1).hand).toContain(dive);
    expect(mustPlayer(state, P2).hand).not.toContain(dive);
    expect(mustPlayer(state, P2).discard).toContain(anatomy);
  });

  it("slot `paidFor`: a resource ability's own effects mark the event; exhausted, it cannot pay for the next play", () => {
    const perched = playerCardIntoPlay(start(), PERCH.id);
    const given = giveCards(perched.state, P1, SWOOP.id, PLAIN.id);
    const [swoop, plain] = given.ids as [InstanceId, InstanceId];
    const viaPerch: readonly Payment[] = [{ ability: { instanceId: perched.id, abilityId: PERCH_RESOURCE.ref.id } }];
    const once = run(given.state, true, play(swoop, viaPerch));
    expect(villainDamage(once.state)).toBe(2);
    expect(mustPlayer(once.state, P1).hand).toContain(swoop);
    expect(mustInstance(once.state, perched.id).exhausted).toBe(true);
    expect(returns(once.events)).toHaveLength(1);

    // Still exhausted: the same payment is refused, and a plain one discards the event.
    const refused = applyCommand(once.state, play(swoop, viaPerch), deps);
    expect(refused.ok).toBe(false);
    const plainly = run(once.state, true, play(swoop, fromHand(plain)));
    expect(villainDamage(plainly.state)).toBe(4);
    expect(mustPlayer(plainly.state, P1).discard).toContain(swoop);
  });

  it("a card that is not an event being played has no play to mark", () => {
    const perched = playerCardIntoPlay(start(), PERCH.id);
    const given = giveCards(perched.state, P1, GLIDER.id);
    const [glider] = given.ids as [InstanceId];
    const { state, events } = run(
      given.state,
      true,
      play(glider, [{ ability: { instanceId: perched.id, abilityId: PERCH_RESOURCE.ref.id } }]),
    );
    expect(marks(events)).toEqual([]);
    expect(mustPlayer(state, P1).playArea).toContain(glider);
  });
});
