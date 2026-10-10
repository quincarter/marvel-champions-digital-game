/**
 * `TriggerEvent cardBeingDiscarded` (docs/phase7-wave9.md §4.1 Q20 = B; `resolve/would-discard.ts`): "Interrupt: When
 * an encounter card effect would discard a card you control, discard [this card] instead of discarding that card",
 * for a card in a hand or a deck. RRG 1.8 "Ownership and Control" (p. 31): "A player controls the cards in their own
 * out-of-play areas (such as the hand, the deck, and the discard pile)"; "Replacement Effect" (p. 37); "Cost" (p. 13).
 *
 * Synthetic cards only: a shield with that interrupt, encounter cards and player cards that discard from a hand and a
 * deck as effects, and an encounter card that takes those discards as a cost.
 */

import { describe, expect, it } from "vitest";
import type { EngineDeps } from "./abilities.js";
import type { Command } from "./commands.js";
import { replay, type GameSession } from "./engine.js";
import type { GameEvent } from "./events.js";
import type { InstanceId, PlayerId } from "./ids.js";
import { activeEncounterDeck, mustInstance, mustPlayer } from "./query.js";
import type { EffectSpec } from "./spec.js";
import type { GameState } from "./state.js";
import { depsOf, stubAbility } from "./testing/abilities.js";
import { runCommandsPicking } from "./testing/drive.js";
import { stubEvent, stubSideScheme, stubSupport, stubTreachery } from "./testing/fixtures.js";
import { defaultPick, giveCard } from "./testing/scenario.js";
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

const SHIELD_ID = "shield.interrupt";
/** "Interrupt: When an encounter card effect would discard a card you control, discard this card instead." */
const SHIELD_INTERRUPT = stubAbility(SHIELD_ID, {
  trigger: {
    kind: "interrupt",
    forced: false,
    would: true,
    on: { on: "cardBeingDiscarded", playerIs: "controller", eventIs: { by: "encounterCard" } },
  },
  effects: [{ kind: "replaceTriggeringEvent", with: [{ kind: "discardFromPlay", target: { kind: "self" } }] }],
});
const SHIELD = stubSupport({ id: "shield", cost: 0, abilities: [SHIELD_INTERRUPT.ref] });

// The effects, printed on an encounter card (a When Revealed) and on a player card (an event).
const CHOSEN: readonly EffectSpec[] = [{ kind: "discardFromHand", player: you, amount: n(1) }];
const RANDOM: readonly EffectSpec[] = [{ kind: "discardFromHand", player: you, amount: n(2), random: true }];
/** "Discard the top 3 cards of your deck. Place 1 threat on the main scheme for each card discarded this way." */
const MILL: readonly EffectSpec[] = [
  {
    kind: "moveCards",
    cards: { kind: "zone", zone: "deck", player: you, top: n(3) },
    to: "discard",
    bind: "milled",
  },
  { kind: "placeThreat", target: { kind: "mainScheme" }, amount: { kind: "var", name: "milled.count" } },
];

const treachery = (id: string, effects: readonly EffectSpec[]) => {
  const ability = stubAbility(`${id}.when-revealed`, { trigger: { kind: "whenRevealed" }, effects });
  return { card: stubTreachery({ id, boostIcons: 0, abilities: [ability.ref] }), ability };
};
const event = (id: string, effects: readonly EffectSpec[]) => {
  const ability = stubAbility(`${id}.action`, { trigger: { kind: "action" }, effects });
  return { card: stubEvent({ id, cost: 0, abilities: [ability.ref] }), ability };
};
const T_CHOSEN = treachery("t-chosen", CHOSEN);
const T_RANDOM = treachery("t-random", RANDOM);
const T_MILL = treachery("t-mill", MILL);
const E_CHOSEN = event("e-chosen", CHOSEN);
const E_RANDOM = event("e-random", RANDOM);
const E_MILL = event("e-mill", MILL);
// "Reveal the top card of the encounter deck."
const REVEAL = event("reveal-top", [{ kind: "revealEncounterCard", player: you }]);
/** A side scheme: "Action: Discard the top card of your deck and 1 card at random from your hand → remove 1 threat from here." */
const TOLL_ID = "toll.action";
const TOLL_ACTION = stubAbility(TOLL_ID, {
  trigger: { kind: "action" },
  cost: { discardFromDeck: 1, discardRandomFromHand: 1 },
  effects: [{ kind: "removeThreat", target: { kind: "self" }, amount: n(1) }],
});
const TOLL = stubSideScheme({ id: "toll", startingThreat: 3, boostIcons: 0, abilities: [TOLL_ACTION.ref] });
const FILLER = stubTreachery({ id: "filler", boostIcons: 0 });

const TREACHERIES = [T_CHOSEN, T_RANDOM, T_MILL];
const EVENTS = [E_CHOSEN, E_RANDOM, E_MILL, REVEAL];
const OTHERS = [...TREACHERIES, ...EVENTS].map((c) => c.ability);
const HEARD: EngineDeps = depsOf(SHIELD_INTERRUPT, TOLL_ACTION, ...OTHERS);
/** The same registry without the listener. */
const UNHEARD: EngineDeps = depsOf(TOLL_ACTION, ...OTHERS);

function start(deps: EngineDeps, players: 1 | 2 = 1): GameState {
  return gameAtFirstTurn({
    players,
    cards: [SHIELD, TOLL, FILLER, ...TREACHERIES.map((t) => t.card), ...EVENTS.map((e) => e.card)],
    deps,
    deck: [SHIELD.id, ...EVENTS.map((e) => e.card.id)],
    encounter: [...copiesOf(FILLER.id, 26), TOLL.id, ...TREACHERIES.map((t) => t.card.id)],
  });
}

interface Run {
  readonly before: GameState;
  readonly state: GameState;
  readonly events: readonly GameEvent[];
  readonly session: GameSession;
  /** How many times the shield's interrupt was offered. */
  readonly offers: number;
}

/**
 * Applies `commands` to `state`, answering each offer of the shield's interrupt from `accept` in order (declined once
 * `accept` runs out) and every other choice with the default pick.
 */
function drive(state: GameState, deps: EngineDeps, accept: readonly boolean[], ...commands: readonly Command[]): Run {
  let offers = 0;
  const pick = (s: GameState) => {
    const choice = s.pendingChoice!;
    const row = choice.options.find((o) => (o.optionId as string).includes(SHIELD_ID));
    if (choice.prompt.kind !== "chooseTriggers" || !row) return defaultPick(s);
    offers += 1;
    return accept[offers - 1] ? [row.optionId] : [];
  };
  const out = runCommandsPicking(state, deps, pick, ...commands);
  return { before: state, state: out.state, events: out.events, session: out.session, offers };
}

/** P1 plays `card` from hand for free. */
const playing = (state: GameState, deps: EngineDeps, card: string, accept: readonly boolean[] = []): Run => {
  const given = giveCard(state, P1, card);
  return drive(given.state, deps, accept, {
    type: "playCard",
    playerId: P1,
    cardInstanceId: given.id,
    payment: [],
    attachToInstanceId: null,
  });
};
/** P1 reveals `card` off the top of the encounter deck in their own turn. */
const revealing = (state: GameState, deps: EngineDeps, card: string, accept: readonly boolean[] = []): Run =>
  playing(onTopOfEncounterDeck(state, card as typeof FILLER.id), deps, REVEAL.card.id, accept);

/** A game with P1's shield in play (`of`: its controller). */
function table(players: 1 | 2 = 1, of: PlayerId = P1) {
  const shield = playerCardIntoPlay(start(HEARD, players), SHIELD.id, of);
  return { state: shield.state, shield: shield.id };
}

/** The cards a "would be discarded" event was pushed for, by how the event ended. */
const announced = (events: readonly GameEvent[], phase: "cancelled" | "resolved"): readonly InstanceId[] =>
  events.flatMap((e) =>
    e.type === "triggerEvent" && e.phase === phase && e.event.kind === "cardBeingDiscarded" ? [e.event.instanceId] : [],
  );
const fromHand = (events: readonly GameEvent[]): readonly InstanceId[] =>
  events.flatMap((e) => (e.type === "cardDiscardedFromHand" ? [e.instanceId] : []));
const hand = (state: GameState, player: PlayerId = P1) => mustPlayer(state, player).hand;
const deck = (state: GameState, player: PlayerId = P1) => mustPlayer(state, player).deck;
const pile = (state: GameState, player: PlayerId = P1) => mustPlayer(state, player).discard;
const inPlay = (state: GameState, id: InstanceId, player: PlayerId = P1) =>
  mustPlayer(state, player).playArea.includes(id);
const mainThreat = (state: GameState) => mustInstance(state, state.mainScheme.instanceId).threat;
function expectReplays(session: GameSession, deps: EngineDeps) {
  const replayed = replay(session.log, deps);
  if (!replayed.ok) throw new Error(replayed.error.message);
  expect(replayed.state).toEqual(session.state);
}

describe("cardBeingDiscarded: when an encounter card effect would discard a card you control from your hand or deck", () => {
  describe("a chosen discard from hand", () => {
    it("by an encounter card's effect, accepted: offered once, the chosen card stays in hand and the shield is discarded", () => {
      const t = table();
      const out = revealing(t.state, HEARD, T_CHOSEN.card.id, [true]);
      expect(out.offers).toBe(1);
      const [saved] = announced(out.events, "cancelled");
      expect(announced(out.events, "cancelled")).toHaveLength(1);
      expect(announced(out.events, "resolved")).toEqual([]);
      expect(fromHand(out.events)).toEqual([]);
      expect(hand(out.state)).toContain(saved);
      expect(pile(out.state)).not.toContain(saved);
      expect(inPlay(out.state, t.shield)).toBe(false);
      expect(pile(out.state)).toContain(t.shield);
      expectReplays(out.session, HEARD);
    });

    it("declined: offered once, the chosen card is discarded and the shield stays", () => {
      const t = table();
      const out = revealing(t.state, HEARD, T_CHOSEN.card.id, [false]);
      expect(out.offers).toBe(1);
      expect(announced(out.events, "cancelled")).toEqual([]);
      const [gone] = announced(out.events, "resolved");
      expect(fromHand(out.events)).toEqual([gone]);
      expect(pile(out.state)).toContain(gone);
      expect(inPlay(out.state, t.shield)).toBe(true);
      expectReplays(out.session, HEARD);
    });

    it("by a player card's effect: not offered, not announced, 1 card discarded", () => {
      const t = table();
      const out = playing(t.state, HEARD, E_CHOSEN.card.id);
      expect(out.offers).toBe(0);
      expect([...announced(out.events, "cancelled"), ...announced(out.events, "resolved")]).toEqual([]);
      expect(fromHand(out.events)).toHaveLength(1);
      expect(inPlay(out.state, t.shield)).toBe(true);
    });
  });

  describe("a random discard of 2 from hand", () => {
    it("by an encounter card's effect: both cards are picked first; accepted on the first, it stays and only the second is discarded", () => {
      const t = table();
      const declined = revealing(t.state, HEARD, T_RANDOM.card.id, [false, false]);
      // Declined twice: 2 offers, 2 cards discarded, in the order picked.
      expect(declined.offers).toBe(2);
      const picks = announced(declined.events, "resolved");
      expect(picks).toHaveLength(2);
      expect(new Set(picks).size).toBe(2);
      expect(fromHand(declined.events)).toEqual(picks);
      expect(inPlay(declined.state, t.shield)).toBe(true);

      const out = revealing(t.state, HEARD, T_RANDOM.card.id, [true]);
      // The same 2 picks (the same seed). The shield answers the first and is gone: the second is not offered.
      expect(out.offers).toBe(1);
      expect(announced(out.events, "cancelled")).toEqual([picks[0]]);
      expect(announced(out.events, "resolved")).toEqual([picks[1]]);
      expect(fromHand(out.events)).toEqual([picks[1]]);
      expect(hand(out.state)).toContain(picks[0]);
      expect(pile(out.state)).toContain(picks[1]);
      expect(pile(out.state)).toContain(t.shield);
      expect(hand(out.state)).toHaveLength(hand(declined.state).length + 1);
      expectReplays(out.session, HEARD);
    });

    it("by a player card's effect: not offered, 2 cards discarded", () => {
      const t = table();
      const out = playing(t.state, HEARD, E_RANDOM.card.id);
      expect(out.offers).toBe(0);
      expect(fromHand(out.events)).toHaveLength(2);
      expect(inPlay(out.state, t.shield)).toBe(true);
    });
  });

  describe("a discard of the top 3 cards of the deck", () => {
    it("declined on the first, accepted on the second: 2 offers, the second card stays on top of the deck, 2 cards are 'discarded this way'", () => {
      const t = table();
      // The reveal event is taken out of the deck first, so the top 3 are read after that.
      const given = giveCard(onTopOfEncounterDeck(t.state, T_MILL.card.id), P1, REVEAL.card.id);
      const [first, second, third, fourth] = deck(given.state) as [InstanceId, InstanceId, InstanceId, InstanceId];
      const out = drive(given.state, HEARD, [false, true], {
        type: "playCard",
        playerId: P1,
        cardInstanceId: given.id,
        payment: [],
        attachToInstanceId: null,
      });
      // The third card's discard is not offered: the shield was discarded for the second.
      expect(out.offers).toBe(2);
      expect(announced(out.events, "resolved")).toEqual([first, third]);
      expect(announced(out.events, "cancelled")).toEqual([second]);
      expect(deck(out.state).slice(0, 2)).toEqual([second, fourth]);
      expect(pile(out.state)).toEqual(expect.arrayContaining([first, third, t.shield]));
      expect(pile(out.state)).not.toContain(second);
      // 1 threat for each card discarded this way: 2, not 3.
      expect(mainThreat(out.state) - mainThreat(given.state)).toBe(2);
      expectReplays(out.session, HEARD);
    });

    it("declined each time: 3 offers, 3 cards discarded in deck order, 3 threat", () => {
      const t = table();
      const given = giveCard(onTopOfEncounterDeck(t.state, T_MILL.card.id), P1, REVEAL.card.id);
      const top = deck(given.state).slice(0, 3);
      const out = drive(given.state, HEARD, [], {
        type: "playCard",
        playerId: P1,
        cardInstanceId: given.id,
        payment: [],
        attachToInstanceId: null,
      });
      expect(out.offers).toBe(3);
      expect(announced(out.events, "resolved")).toEqual(top);
      // The last discarded is the top of the discard pile, under the event that was played.
      expect(pile(out.state).slice(0, 4)).toEqual([given.id, ...[...top].reverse()]);
      expect(mainThreat(out.state) - mainThreat(given.state)).toBe(3);
      expect(inPlay(out.state, t.shield)).toBe(true);
    });

    it("by a player card's effect: not offered, 3 cards discarded, 3 threat", () => {
      const t = table();
      const out = playing(t.state, HEARD, E_MILL.card.id);
      expect(out.offers).toBe(0);
      expect([...announced(out.events, "cancelled"), ...announced(out.events, "resolved")]).toEqual([]);
      expect(mainThreat(out.state) - mainThreat(out.before)).toBe(3);
      expect(inPlay(out.state, t.shield)).toBe(true);
    });
  });

  it("an encounter card's cost (discard the top card of your deck and 1 card at random from your hand →): not offered, both discarded", () => {
    const t = table();
    const toll = encounterCardInVillainArea(t.state, TOLL.id, 3);
    const top = deck(toll.state)[0]!;
    const out = drive(toll.state, HEARD, [true, true], {
      type: "useAbility",
      playerId: P1,
      cardInstanceId: toll.id,
      abilityId: TOLL_ACTION.ref.id,
      payment: [],
    });
    expect(out.offers).toBe(0);
    expect([...announced(out.events, "cancelled"), ...announced(out.events, "resolved")]).toEqual([]);
    expect(pile(out.state)).toContain(top);
    expect(fromHand(out.events)).toHaveLength(1);
    expect(hand(out.state)).toHaveLength(hand(toll.state).length - 1);
    expect(mustInstance(out.state, toll.id).threat).toBe(2);
    expect(inPlay(out.state, t.shield)).toBe(true);
  });

  it("another player's shield: not offered for a card you control (1 chosen card discarded from P1's hand)", () => {
    const t = table(2, P2);
    const out = revealing(t.state, HEARD, T_CHOSEN.card.id, [true]);
    expect(out.offers).toBe(0);
    expect(fromHand(out.events)).toHaveLength(1);
    expect(hand(out.state)).toHaveLength(hand(out.before).length - 2);
    expect(inPlay(out.state, t.shield, P2)).toBe(true);
  });

  it("no listener in the registry: the same log and state as with one out of play, for each of the 3 discards", () => {
    for (const card of TREACHERIES.map((x) => x.card.id)) {
      const unheard = revealing(start(UNHEARD), UNHEARD, card);
      const heard = revealing(start(HEARD), HEARD, card);
      expect(unheard.events, card).toEqual(heard.events);
      expect(unheard.state, card).toEqual(heard.state);
      expect(unheard.events.some((e) => e.type === "triggerEvent" && e.event.kind === "cardBeingDiscarded")).toBe(
        false,
      );
      expectReplays(unheard.session, UNHEARD);
      expectReplays(heard.session, HEARD);
    }
    // The 3 cards left the deck in order and the 2 random picks left the hand.
    const milled = revealing(start(UNHEARD), UNHEARD, T_MILL.card.id);
    expect(mainThreat(milled.state) - mainThreat(milled.before)).toBe(3);
    expect(fromHand(revealing(start(UNHEARD), UNHEARD, T_RANDOM.card.id).events)).toHaveLength(2);
    expect(activeEncounterDeck(milled.state).discard).toHaveLength(1);
  });
});
