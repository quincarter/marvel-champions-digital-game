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

const EVENTS = [E_CHOSEN, E_RANDOM, E_MILL, E_MOVE, E_COSTLY, REVEAL];
const OTHERS = [...EVENTS.map((e) => e.ability), T_CHOSEN_ABILITY, TOLL_ACTION];
const HEARD: EngineDeps = depsOf(RAGE_RESPONSE, ...OTHERS);
/** The same registry without the listener. */
const UNHEARD: EngineDeps = depsOf(...OTHERS);

function start(deps: EngineDeps): GameState {
  const game = gameAtFirstTurn({
    players: 1,
    cards: [RAGE, TOLL, FILLER, T_CHOSEN, PAYER, ...EVENTS.map((e) => e.card)],
    deps,
    deck: [RAGE.id, PAYER.id, ...EVENTS.map((e) => e.card.id)],
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
    const row = choice.options.find((o) => (o.optionId as string).includes(RAGE_ID));
    if (choice.prompt.kind !== "chooseTriggers" || !row) return defaultPick(s);
    offers += 1;
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
