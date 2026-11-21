/**
 * `TriggerEvent cardDiscardedFromHand` (issue #922; `resolve/hand-discard.ts`): "Response: After an identity-specific
 * card is discarded by an ability, tuck that card under here from your discard pile" (the Hulk house rule pack), the
 * hand's counterpart of `cardDiscardedFromDeck`. Also the `by` / `how` the issue asked for on a player deck's discard.
 * RRG 1.8 "Discard" (p. 16): "Responses to the discarding of any of those cards are resolved after all discards are
 * made"; "Cost" (p. 13); "Resource" (p. 37).
 *
 * Synthetic cards only: a support that answers the discard by returning the card to its owner's hand, player events and
 * an encounter card that discard from a hand and a deck, an encounter side scheme that discards both as a cost, and a
 * player event that costs 1.
 */

import { describe, expect, it } from "vitest";
import type { EngineDeps } from "./abilities.js";
import type { Command } from "./commands.js";
import { replay, type GameSession } from "./engine.js";
import type { GameEvent } from "./events.js";
import type { InstanceId, PlayerId } from "./ids.js";
import { mustPlayer } from "./query.js";
import type { EffectSpec } from "./spec.js";
import type { GameState } from "./state.js";
import { depsOf, stubAbility } from "./testing/abilities.js";
import { runCommandsPicking } from "./testing/drive.js";
import { stubEvent, stubSideScheme, stubSupport, stubTreachery } from "./testing/fixtures.js";
import { defaultPick, giveCard } from "./testing/scenario.js";
import type { TriggerEvent } from "./trigger-events.js";
import {
  copiesOf,
  encounterCardInVillainArea,
  gameAtFirstTurn,
  onTopOfEncounterDeck,
  P1,
  P2,
  playerCardIntoPlay,
} from "./testing/wave3.js";

const you = { kind: "controller" } as const;
const n = (value: number) => ({ kind: "const", value }) as const;

const RAGE_ID = "rage.response";
/**
 * "Response: After a card is discarded from your hand or deck by an ability, return that card to your hand. (Limit
 * twice per phase.)" One ability, one limit, for both places (what the issue's pack needs).
 */
const RAGE_RESPONSE = stubAbility(RAGE_ID, {
  trigger: {
    kind: "response",
    forced: false,
    on: { on: ["cardDiscardedFromHand", "cardDiscardedFromDeck"], playerIs: "controller" },
  },
  limit: { count: 2, period: "phase" },
  effects: [{ kind: "moveCards", cards: { kind: "ref", ref: { kind: "eventTarget" } }, to: "hand" }],
});
const RAGE = stubSupport({ id: "rage", cost: 0, abilities: [RAGE_RESPONSE.ref] });

const event = (id: string, effects: readonly EffectSpec[], cost = 0) => {
  const ability = stubAbility(`${id}.action`, { trigger: { kind: "action" }, effects });
  return { card: stubEvent({ id, cost, abilities: [ability.ref] }), ability };
};
const E_CHOSEN = event("e-chosen", [{ kind: "discardFromHand", player: you, amount: n(1) }]);
const E_RANDOM = event("e-random", [{ kind: "discardFromHand", player: you, amount: n(2), random: true }]);
const E_MILL = event("e-mill", [
  { kind: "moveCards", cards: { kind: "zone", zone: "deck", player: you, top: n(2) }, to: "discard" },
]);
/** "Discard 1 card from your hand", as a `moveCards` of a hand card. */
const E_MOVE = event("e-move", [
  { kind: "moveCards", cards: { kind: "zone", zone: "hand", player: you, top: n(1) }, to: "discard" },
]);
const E_COSTLY = event("e-costly", [], 1);
/** A card with 1 resource, to pay with. */
const PAYER = stubEvent({ id: "payer", cost: 0, resources: 1 });
// "Reveal the top card of the encounter deck."
const REVEAL = event("reveal-top", [{ kind: "revealEncounterCard", player: you }]);
const T_CHOSEN_ABILITY = stubAbility("t-chosen.when-revealed", {
  trigger: { kind: "whenRevealed" },
  effects: [{ kind: "discardFromHand", player: you, amount: n(1) }],
});
const T_CHOSEN = stubTreachery({ id: "t-chosen", boostIcons: 0, abilities: [T_CHOSEN_ABILITY.ref] });
/** "Action: Discard the top card of your deck and 1 card at random from your hand → remove 1 threat from here." */
const TOLL_ACTION = stubAbility("toll.action", {
  trigger: { kind: "action" },
  cost: { discardFromDeck: 1, discardRandomFromHand: 1 },
  effects: [{ kind: "removeThreat", target: { kind: "self" }, amount: n(1) }],
});
const TOLL = stubSideScheme({ id: "toll", startingThreat: 3, boostIcons: 0, abilities: [TOLL_ACTION.ref] });
const FILLER = stubTreachery({ id: "filler", boostIcons: 0 });
/** "Each player chooses and discards 1 card from their hand." */
const E_EACH = event("e-each", [{ kind: "discardFromHand", player: { kind: "each" }, amount: n(1) }]);
/** A support: "Action: Discard 1 card from your hand → draw 0 cards." A chosen hand-discard cost. */
const FURY_ACTION = stubAbility("fury.action", {
  trigger: { kind: "action" },
  cost: { discardFromHand: { min: 1, max: 1 } },
  effects: [{ kind: "draw", player: you, amount: n(0) }],
});
const FURY = stubSupport({ id: "fury", cost: 0, abilities: [FURY_ACTION.ref] });
const WARD_ID = "ward.interrupt";
/** "Interrupt: When a card you control would be discarded, …": always declined, so each card waits in its window. */
const WARD_INTERRUPT = stubAbility(WARD_ID, {
  trigger: { kind: "interrupt", forced: false, would: true, on: { on: "cardBeingDiscarded", playerIs: "controller" } },
  effects: [{ kind: "replaceTriggeringEvent", with: [] }],
});
const WARD = stubSupport({ id: "ward", cost: 0, abilities: [WARD_INTERRUPT.ref] });
/** "Interrupt: When a card you control would be discarded, discard 1 card from your hand → draw 0 cards." A cost paid inside a "would" window. */
const WARDEN_INTERRUPT = stubAbility("warden.interrupt", {
  trigger: { kind: "interrupt", forced: false, would: true, on: { on: "cardBeingDiscarded", playerIs: "controller" } },
  limit: { count: 1, period: "phase" },
  cost: { discardFromHand: { min: 1, max: 1 } },
  effects: [{ kind: "draw", player: you, amount: n(0) }],
});
const WARDEN = stubSupport({ id: "warden", cost: 0, abilities: [WARDEN_INTERRUPT.ref] });
/**
 * One support, two abilities: "Action: Discard 1 card from your hand." and "Interrupt: When a card you control would be
 * discarded, discard 1 card from your hand." (limit once per phase), the inner discard an effect of the same card.
 */
const TWIN_ACTION = stubAbility("twin.action", {
  trigger: { kind: "action" },
  effects: [{ kind: "discardFromHand", player: you, amount: n(1) }],
});
const TWIN_INTERRUPT = stubAbility("twin.interrupt", {
  trigger: { kind: "interrupt", forced: false, would: true, on: { on: "cardBeingDiscarded", playerIs: "controller" } },
  limit: { count: 1, period: "phase" },
  effects: [{ kind: "discardFromHand", player: you, amount: n(1) }],
});
const TWIN = stubSupport({ id: "twin", cost: 0, abilities: [TWIN_ACTION.ref, TWIN_INTERRUPT.ref] });
/** A second Rage, with an ability of its own. */
const RAGE_TWO_RESPONSE = stubAbility("rage-two.response", { ...RAGE_RESPONSE.definition });
const RAGE_TWO = stubSupport({ id: "rage-two", cost: 0, abilities: [RAGE_TWO_RESPONSE.ref] });

const EVENTS = [E_CHOSEN, E_RANDOM, E_MILL, E_MOVE, E_COSTLY, REVEAL, E_EACH];
const OTHERS = [...EVENTS.map((e) => e.ability), T_CHOSEN_ABILITY, TOLL_ACTION, FURY_ACTION];
const HEARD: EngineDeps = depsOf(RAGE_RESPONSE, ...OTHERS);
/** The same registry without the listener. */
const UNHEARD: EngineDeps = depsOf(...OTHERS);
/** With a "would be discarded" interrupt too. */
const WARDED: EngineDeps = depsOf(RAGE_RESPONSE, WARD_INTERRUPT, ...OTHERS);
/** With an interrupt that pays a hand-discard cost. */
const WARDEN_GAME: EngineDeps = depsOf(RAGE_RESPONSE, WARDEN_INTERRUPT, ...OTHERS);
/** With the support whose two abilities both discard. */
const TWIN_GAME: EngineDeps = depsOf(RAGE_RESPONSE, TWIN_ACTION, TWIN_INTERRUPT, ...OTHERS);
/** With two Rages. */
const TWO_RAGES: EngineDeps = depsOf(RAGE_RESPONSE, RAGE_TWO_RESPONSE, ...OTHERS);

function start(deps: EngineDeps, players: 1 | 2 = 1): GameState {
  const game = gameAtFirstTurn({
    players,
    cards: [RAGE, RAGE_TWO, FURY, WARD, WARDEN, TWIN, TOLL, FILLER, T_CHOSEN, PAYER, ...EVENTS.map((e) => e.card)],
    deps,
    deck: [RAGE.id, RAGE_TWO.id, FURY.id, WARD.id, WARDEN.id, TWIN.id, PAYER.id, ...EVENTS.map((e) => e.card.id)],
    encounter: [...copiesOf(FILLER.id, 26), TOLL.id, T_CHOSEN.id],
  });
  return game;
}

interface Run {
  readonly before: GameState;
  readonly state: GameState;
  readonly events: readonly GameEvent[];
  readonly session: GameSession;
  /** How many times Rage's response was offered. */
  readonly offers: number;
}

/** Applies `commands`, accepting every offer of Rage's response and answering every other choice by default. */
function drive(state: GameState, deps: EngineDeps, ...commands: readonly Command[]): Run {
  let offers = 0;
  const pick = (s: GameState) => {
    const choice = s.pendingChoice!;
    // A hand-discard cost is paid with the first card offered (an empty pick backs out).
    if (choice.prompt.kind === "chooseCostCards") return [choice.options[0]!.optionId];
    const row = choice.options.find((o) => /rage|warden|twin/.test(o.optionId as string));
    if (choice.prompt.kind === "chooseTriggers" && !row) return [];
    if (choice.prompt.kind !== "chooseTriggers" || !row) return defaultPick(s);
    if (/rage/.test(row.optionId as string)) offers += 1;
    return [row.optionId];
  };
  const out = runCommandsPicking(state, deps, pick, ...commands);
  return { before: state, state: out.state, events: out.events, session: out.session, offers };
}

const play = (id: InstanceId, payment: Extract<Command, { type: "playCard" }>["payment"] = []): Command => ({
  type: "playCard",
  playerId: P1,
  cardInstanceId: id,
  payment,
  attachToInstanceId: null,
});

/** P1, with Rage in play (or not, under `UNHEARD`), plays `card` from hand for free. */
function playing(card: string, deps: EngineDeps = HEARD): Run & { readonly card: InstanceId } {
  const base = start(deps);
  const ready = deps === HEARD ? playerCardIntoPlay(base, RAGE.id, P1).state : base;
  const given = giveCard(ready, P1, card);
  return { ...drive(given.state, deps, play(given.id)), card: given.id };
}

type HandDiscard = Extract<TriggerEvent, { kind: "cardDiscardedFromHand" }>;
type DeckDiscard = Extract<TriggerEvent, { kind: "cardDiscardedFromDeck" }>;
/** The discard events that were announced (pushed and resolved), in order. */
const announced = <K extends TriggerEvent["kind"]>(events: readonly GameEvent[], kind: K) =>
  events.flatMap((e) =>
    e.type === "triggerEvent" && e.phase === "resolved" && e.event.kind === kind
      ? [e.event as Extract<TriggerEvent, { kind: K }>]
      : [],
  );
const hand = (state: GameState, player: PlayerId = P1) => mustPlayer(state, player).hand;
const pile = (state: GameState, player: PlayerId = P1) => mustPlayer(state, player).discard;
function expectReplays(session: GameSession, deps: EngineDeps) {
  const replayed = replay(session.log, deps);
  if (!replayed.ok) throw new Error(replayed.error.message);
  expect(replayed.state).toEqual(session.state);
}

describe("cardDiscardedFromHand: after a card is discarded from a hand by an ability (issue #922)", () => {
  it("a player card's chosen discard: announced once, from the discard pile, with its source, side and how", () => {
    const out = playing(E_CHOSEN.card.id);
    const [heard, ...more] = announced(out.events, "cardDiscardedFromHand");
    expect(more).toEqual([]);
    expect(heard).toMatchObject<Partial<HandDiscard>>({
      playerId: P1,
      to: "discard",
      sourceInstanceId: out.card,
      by: "playerCard",
      how: "effect",
    });
    // The response took it back: it is in the hand, not the discard pile.
    expect(out.offers).toBe(1);
    expect(hand(out.state)).toContain(heard!.instanceId);
    expect(pile(out.state)).not.toContain(heard!.instanceId);
    expectReplays(out.session, HEARD);
  });

  it("an encounter card's chosen discard: by the encounter card", () => {
    const base = playerCardIntoPlay(start(HEARD), RAGE.id, P1).state;
    const given = giveCard(onTopOfEncounterDeck(base, T_CHOSEN.id), P1, REVEAL.card.id);
    const out = drive(given.state, HEARD, play(given.id));
    expect(announced(out.events, "cardDiscardedFromHand")).toEqual([
      expect.objectContaining({ by: "encounterCard", how: "effect" }),
    ]);
    expect(out.offers).toBe(1);
  });

  it("a random discard of 2 and a moveCards of a hand card are heard too, one event per card", () => {
    const random = playing(E_RANDOM.card.id);
    expect(announced(random.events, "cardDiscardedFromHand")).toHaveLength(2);
    expect(random.offers).toBe(2);
    const moved = playing(E_MOVE.card.id);
    expect(announced(moved.events, "cardDiscardedFromHand")).toEqual([
      expect.objectContaining({ by: "playerCard", how: "effect" }),
    ]);
  });

  it("one limit for the hand and the deck: twice per phase across a hand discard of 2 and a deck discard of 2", () => {
    const base = playerCardIntoPlay(start(HEARD), RAGE.id, P1).state;
    const random = giveCard(base, P1, E_RANDOM.card.id);
    const mill = giveCard(random.state, P1, E_MILL.card.id);
    const out = drive(mill.state, HEARD, play(random.id), play(mill.id));
    expect(announced(out.events, "cardDiscardedFromHand")).toHaveLength(2);
    // The limit is spent: the deck discards are made, and nothing answers them.
    expect(announced(out.events, "cardDiscardedFromDeck")).toEqual([]);
    expect(out.offers).toBe(2);
  });

  it("a player deck's discard carries the side of the discarding card and effect or cost (issue #922, item 3)", () => {
    const out = playing(E_MILL.card.id);
    expect(announced(out.events, "cardDiscardedFromDeck")).toEqual([
      expect.objectContaining<Partial<DeckDiscard>>({ by: "playerCard", how: "effect", sourceInstanceId: out.card }),
      expect.objectContaining<Partial<DeckDiscard>>({ by: "playerCard", how: "effect", sourceInstanceId: out.card }),
    ]);
    expect(out.offers).toBe(2);
  });

  it("an encounter card's cost (discard the top card of your deck and 1 random card from your hand →): both heard as a cost", () => {
    const base = playerCardIntoPlay(start(HEARD), RAGE.id, P1).state;
    const toll = encounterCardInVillainArea(base, TOLL.id, 3);
    const out = drive(toll.state, HEARD, {
      type: "useAbility",
      playerId: P1,
      cardInstanceId: toll.id,
      abilityId: TOLL_ACTION.ref.id,
      payment: [],
    });
    expect(announced(out.events, "cardDiscardedFromHand")).toEqual([
      expect.objectContaining<Partial<HandDiscard>>({ by: "encounterCard", how: "cost", sourceInstanceId: toll.id }),
    ]);
    expect(announced(out.events, "cardDiscardedFromDeck")).toEqual([
      expect.objectContaining<Partial<DeckDiscard>>({ by: "encounterCard", how: "cost", sourceInstanceId: toll.id }),
    ]);
    expect(out.offers).toBe(2);
  });

  it("a card spent to pay for a card is not heard: it is spent, not discarded by an ability", () => {
    const base = playerCardIntoPlay(start(HEARD), RAGE.id, P1).state;
    const costly = giveCard(base, P1, E_COSTLY.card.id);
    const payer = giveCard(costly.state, P1, PAYER.id);
    const out = drive(payer.state, HEARD, play(costly.id, [{ fromHand: payer.id }]));
    expect(pile(out.state)).toContain(payer.id);
    expect(announced(out.events, "cardDiscardedFromHand")).toEqual([]);
    expect(out.offers).toBe(0);
  });

  it("no listener in the registry: nothing recorded or announced, and the discards are made as before", () => {
    for (const card of [E_CHOSEN.card.id, E_RANDOM.card.id, E_MOVE.card.id]) {
      const out = playing(card, UNHEARD);
      expect(out.state.pendingHandDiscards, card).toBeUndefined();
      expect(announced(out.events, "cardDiscardedFromHand"), card).toEqual([]);
      expect(pile(out.state).length, card).toBeGreaterThan(pile(out.before).length);
      expectReplays(out.session, UNHEARD);
    }
  });
});

/** The position in the log of the first entry `match` finds; -1 when none does. */
const firstIndex = (events: readonly GameEvent[], match: (e: GameEvent) => boolean) => events.findIndex(match);
const isHandResponse = (e: GameEvent) =>
  e.type === "triggerEvent" && e.event.kind === "cardDiscardedFromHand" && e.phase === "resolved";

describe("cardDiscardedFromHand: one effect's discards share one window, after all of them (RRG 1.8 'Discard', p. 16)", () => {
  it("each player discards: the window opens once both players have discarded", () => {
    const base = playerCardIntoPlay(start(HEARD, 2), RAGE.id, P1).state;
    const given = giveCard(base, P1, E_EACH.card.id);
    const out = drive(given.state, HEARD, play(given.id));
    const discards = out.events.filter((e) => e.type === "cardDiscardedFromHand");
    expect(discards.map((e) => (e as { playerId: PlayerId }).playerId)).toEqual([P1, P2]);
    // Both cards were discarded before any response to either resolved.
    const lastDiscard = out.events.lastIndexOf(discards[1]!);
    expect(firstIndex(out.events, isHandResponse)).toBeGreaterThan(lastDiscard);
    // Rage answers its controller's card only.
    expect(out.offers).toBe(1);
    expectReplays(out.session, HEARD);
  });

  it("cards that wait in a 'would be discarded' window: announced once each, after the last of them is discarded", () => {
    const base = playerCardIntoPlay(playerCardIntoPlay(start(WARDED), WARD.id, P1).state, RAGE.id, P1).state;
    const given = giveCard(base, P1, E_RANDOM.card.id);
    const out = drive(given.state, WARDED, play(given.id));
    const applied = out.events.filter(
      (e) => e.type === "triggerEvent" && e.event.kind === "cardBeingDiscarded" && e.phase === "resolved",
    );
    expect(applied).toHaveLength(2);
    expect(announced(out.events, "cardDiscardedFromHand")).toHaveLength(2);
    expect(firstIndex(out.events, isHandResponse)).toBeGreaterThan(out.events.lastIndexOf(applied[1]!));
    expect(out.offers).toBe(2);
    expectReplays(out.session, WARDED);
  });

  it("a chosen hand-discard cost of a player card: heard as a cost", () => {
    const base = playerCardIntoPlay(start(HEARD), RAGE.id, P1).state;
    const fury = playerCardIntoPlay(base, FURY.id, P1);
    const paid = hand(fury.state)[0]!;
    const out = drive(fury.state, HEARD, {
      type: "useAbility",
      playerId: P1,
      cardInstanceId: fury.id,
      abilityId: FURY_ACTION.ref.id,
      payment: [],
      costChoices: { discard: [paid] },
    });
    expect(announced(out.events, "cardDiscardedFromHand")).toEqual([
      expect.objectContaining<Partial<HandDiscard>>({ instanceId: paid, by: "playerCard", how: "cost" }),
    ]);
    expect(out.offers).toBe(1);
  });

  it("two responses: once the first takes the card back, the second is not offered for it", () => {
    const one = playerCardIntoPlay(start(TWO_RAGES), RAGE.id, P1).state;
    const base = playerCardIntoPlay(one, RAGE_TWO.id, P1).state;
    const given = giveCard(base, P1, E_CHOSEN.card.id);
    const out = drive(given.state, TWO_RAGES, play(given.id));
    const [heard] = announced(out.events, "cardDiscardedFromHand");
    expect(out.offers).toBe(1);
    expect(hand(out.state)).toContain(heard!.instanceId);
    expectReplays(out.session, TWO_RAGES);
  });
  it("a hand-discard cost paid by an interrupt inside another discard's 'would' window is answered at once, not held", () => {
    const one = playerCardIntoPlay(start(WARDEN_GAME), WARDEN.id, P1).state;
    const base = playerCardIntoPlay(one, RAGE.id, P1).state;
    const given = giveCard(base, P1, E_RANDOM.card.id);
    const out = drive(given.state, WARDEN_GAME, play(given.id));
    const heard = announced(out.events, "cardDiscardedFromHand");
    // The Warden's cost card first, by its own window; then the effect's cards.
    expect(heard[0]).toMatchObject<Partial<HandDiscard>>({ how: "cost" });
    const costResponse = firstIndex(out.events, isHandResponse);
    const lastApplied = out.events.findLastIndex(
      (e) => e.type === "triggerEvent" && e.event.kind === "cardBeingDiscarded" && e.phase === "resolved",
    );
    expect(costResponse).toBeLessThan(lastApplied);
    expectReplays(out.session, WARDEN_GAME);
  });
  it("a discard by another ability of the same card, inside its 'would' window, is answered at once, not held", () => {
    const one = playerCardIntoPlay(start(TWIN_GAME), TWIN.id, P1);
    const base = playerCardIntoPlay(one.state, RAGE.id, P1).state;
    const out = drive(base, TWIN_GAME, {
      type: "useAbility",
      playerId: P1,
      cardInstanceId: one.id,
      abilityId: TWIN_ACTION.ref.id,
      payment: [],
    });
    const outerApplied = out.events.findLastIndex(
      (e) => e.type === "triggerEvent" && e.event.kind === "cardBeingDiscarded" && e.phase === "resolved",
    );
    // The interrupt's own discard is answered before the Action's card is discarded.
    expect(announced(out.events, "cardDiscardedFromHand")).toHaveLength(2);
    expect(firstIndex(out.events, isHandResponse)).toBeLessThan(outerApplied);
    expectReplays(out.session, TWIN_GAME);
  });
});
