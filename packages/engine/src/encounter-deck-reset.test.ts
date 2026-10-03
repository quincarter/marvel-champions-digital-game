/**
 * docs/phase7-wave6.md §3.60: the encounter deck resets as an event (§4.1 Q38: at the move that empties it, not at the
 * next draw). Synthetic cards shaped like Wheel of Genres, Spinning (`mojo` 39026a): "Forced Response: After the
 * encounter deck resets, if there are no set-aside modular encounter sets remaining, the players lose the game.
 * Otherwise, flip this card." — counted on the listening environment here.
 *
 * Sources:
 * - RRG 1.8 "Encounter Deck" (p. 17): "If the encounter deck is empty, the encounter discard pile is immediately
 *   shuffled to create a new encounter deck. When this occurs, place an acceleration token next to the main scheme
 *   deck." / "If a card ability discards a specified number of cards from the encounter deck or until a card with
 *   specific criteria is discarded, discard cards from the encounter deck until the discard condition is met or the
 *   encounter deck is empty. If the encounter deck is emptied this way, that card ability is considered to be
 *   fulfilled. Do not continue the discard effect with the newly shuffled encounter deck." / "If the encounter deck
 *   empties during the resolution of any other type of game effect (for example, the dealing of encounter cards), that
 *   effect finishes resolving after the encounter deck has been reset."
 * - Ruling, April 30, 2026 (3), question 7: "If the last sentence of an event empties the deck, is it shuffled into
 *   the new deck?" Answer 7: "The deck is reshuffled **before** the currently resolving card enters the discard pile."
 * - The Wrecking Crew insert, "Multiple Villains and Encounter Decks": "When a villain's encounter deck is empty,
 *   shuffle its discard pile back into its encounter deck and place an acceleration token" — only that deck.
 */

import { flat, type CardId } from "@mc/content";
import { describe, expect, it } from "vitest";
import type { EngineDeps } from "./abilities.js";
import { replay, startSession, type GameSession } from "./engine.js";
import type { GameEvent } from "./events.js";
import type { EncounterDeckId, InstanceId } from "./ids.js";
import { activeEncounterDeck, activeEncounterDeckId, locateCard, mustInstance, mustPlayer } from "./query.js";
import { createGame } from "./setup.js";
import type { EffectSpec } from "./spec.js";
import type { GameState } from "./state.js";
import { depsOf, stubAbility, type StubAbility } from "./testing/abilities.js";
import { driveSession } from "./testing/drive.js";
import {
  stubEnvironment,
  stubEvent,
  stubMainScheme,
  stubMinion,
  stubTreachery,
  stubVillain,
} from "./testing/fixtures.js";
import { DEFAULT_CARDS, DEFAULT_DECK, HERO, withEncounterPiles } from "./testing/scenario.js";
import { copiesOf, encounterCardInVillainArea, gameAtFirstTurn, P1, playFree } from "./testing/wave3.js";

const self = { kind: "self" } as const;
const count = (counterType: string): EffectSpec => ({
  kind: "addCounters",
  target: self,
  counterType,
  amount: { kind: "const", value: 1 },
});

/** "Forced Response: After the encounter deck resets, …" — any encounter deck. */
const WHEEL_RESETS = stubAbility("wheel.forced-response", {
  trigger: { kind: "response", forced: true, on: { on: "deckRanOut", eventIs: { deck: "encounter" } } },
  effects: [count("resets")],
});
/** A player's deck running out is a different deck: this must never hear an encounter deck's reset. */
const WHEEL_PLAYER_DECK = stubAbility("wheel.player-deck", {
  trigger: { kind: "response", forced: true, on: { on: "deckRanOut", eventIs: { deck: "player" } } },
  effects: [count("playerDecks")],
});
const WHEEL = stubEnvironment({ id: "wheel", abilities: [WHEEL_RESETS.ref, WHEEL_PLAYER_DECK.ref] });

const BLANK = stubTreachery({ id: "blank", boostIcons: 0 });
const LAST = stubTreachery({ id: "last", boostIcons: 0 });
const GOON = stubMinion({ id: "goon", atk: 0, sch: 0, hp: 2, boostIcons: 0 });

const event = (id: string, effects: readonly EffectSpec[]) => {
  const ability = stubAbility(`${id}.action`, { trigger: { kind: "action" }, effects });
  return { card: stubEvent({ id, cost: 0, abilities: [ability.ref] }), ability };
};
const DEAL = event("deal", [{ kind: "dealEncounterCard", player: { kind: "controller" } }]);
const BOOST = event("boost", [{ kind: "giveBoostCard", enemy: { kind: "villain" } }]);
const DISCARD_THREE = event("discard-three", [
  { kind: "discardEncounterCards", count: { kind: "const", value: 3 }, bind: "dumped" },
]);
const DISCARD_ONE = event("discard-one", [{ kind: "discardEncounterCards", count: { kind: "const", value: 1 } }]);
/** "Search the encounter deck for Goon and put it into play." */
const SEARCH = event("search", [
  { kind: "selectCards", slot: "found", cards: { kind: "encounter", zones: ["deck"], filter: { name: "goon" } } },
  { kind: "putIntoPlay", card: { kind: "slot", slot: "found" }, controller: { kind: "controller" } },
]);
const REVEAL = event("reveal", [{ kind: "revealEncounterCard", player: { kind: "controller" } }]);
const DEAL_THREE = event("deal-three", [
  { kind: "dealEncounterCard", player: { kind: "controller" }, count: { kind: "const", value: 3 } },
]);
const EVENTS = [DEAL, BOOST, DISCARD_THREE, DISCARD_ONE, SEARCH, REVEAL, DEAL_THREE];

const LISTENING: EngineDeps = depsOf(WHEEL_RESETS, WHEEL_PLAYER_DECK, ...EVENTS.map((e) => e.ability));
/** The same game with no ability on `deckRanOut` anywhere in the registry. */
const DEAF: EngineDeps = depsOf(...EVENTS.map((e) => e.ability));

interface Table {
  readonly state: GameState;
  /** The listening environment, in the villain's area. */
  readonly wheel: InstanceId;
  /** Encounter-deck instance ids by card, in a fixed order (never the shuffle's). */
  readonly ids: (card: CardId) => readonly InstanceId[];
}

/** A game at P1's first turn with `encounter` as the deck (plus the Wheel, in play), no discard pile yet. */
function table(encounter: readonly CardId[], deps: EngineDeps = LISTENING): Table {
  const base = gameAtFirstTurn({
    cards: [WHEEL, BLANK, LAST, GOON, ...EVENTS.map((e) => e.card)],
    deps,
    encounter: [WHEEL.id, ...encounter],
    deck: EVENTS.flatMap((e) => copiesOf(e.card.id, 2)),
  });
  const placed = encounterCardInVillainArea(base, WHEEL.id);
  const ids = (card: CardId): readonly InstanceId[] =>
    Object.values(placed.state.instances)
      .filter((i) => i.cardId === card && i.ownerId === null)
      .map((i) => i.instanceId)
      .sort();
  return { state: placed.state, wheel: placed.id, ids };
}

const resets = (state: GameState, wheel: InstanceId): number => mustInstance(state, wheel).counters.resets ?? 0;
const sorted = (ids: readonly InstanceId[]): readonly InstanceId[] => [...ids].sort();
const tokens = (state: GameState): number => state.mainScheme.accelerationTokens;

/** Index of the first event after `from` that matches, or a failure naming what was missing. */
function indexAfter(events: readonly GameEvent[], from: number, label: string, match: (e: GameEvent) => boolean) {
  const index = events.findIndex((e, i) => i > from && match(e));
  if (index < 0) throw new Error(`no ${label} after event ${from}`);
  return index;
}
const movedFrom = (id: InstanceId, kind: string) => (e: GameEvent) =>
  e.type === "cardMoved" && e.instanceId === id && e.from.kind === kind;
const movedTo = (id: InstanceId, kind: string) => (e: GameEvent) =>
  e.type === "cardMoved" && e.instanceId === id && e.to.kind === kind;
const shuffled = (e: GameEvent) => e.type === "deckShuffled" && e.zone.kind === "encounterDeck";
const token = (e: GameEvent) => e.type === "accelerationTokenAdded";
const counted = (wheel: InstanceId) => (e: GameEvent) =>
  e.type === "counterAdded" && e.instanceId === wheel && e.counterType === "resets";
const times = (events: readonly GameEvent[], match: (e: GameEvent) => boolean): number => events.filter(match).length;

function expectReplays(session: GameSession, deps: EngineDeps = LISTENING): void {
  const replayed = replay(session.log, deps);
  if (!replayed.ok) throw new Error(replayed.error.message);
  expect(replayed.state).toEqual(session.state);
}

describe("§3.60 the encounter deck resets at the move that empties it", () => {
  it("dealing the last card: the discard pile is shuffled into a new deck and a token placed, with no later draw", () => {
    const t = table([LAST.id, ...copiesOf(BLANK.id, 3)]);
    const [last] = t.ids(LAST.id);
    const blanks = t.ids(BLANK.id);
    const start = withEncounterPiles(t.state, { deck: [last!], discard: blanks });

    const { state, events, session } = playFree(start, LISTENING, DEAL.card.id);
    // The reset has already happened: nothing drew from the deck after the deal.
    expect(mustPlayer(state, P1).dealtEncounter).toEqual([last]);
    expect(sorted(activeEncounterDeck(state).deck)).toEqual(blanks);
    expect(activeEncounterDeck(state).discard).toEqual([]);
    expect(tokens(state)).toBe(tokens(start) + 1);
    expect(resets(state, t.wheel)).toBe(1);

    // Exact order: the deal, the shuffle, the token, then the Forced Response.
    const dealt = indexAfter(events, -1, "deal", movedFrom(last!, "encounterDeck"));
    const shuffle = indexAfter(events, dealt, "shuffle", shuffled);
    const placed = indexAfter(events, shuffle, "token", token);
    indexAfter(events, placed, "forced response", counted(t.wheel));
    expect(events[shuffle]).toMatchObject({ zone: { kind: "encounterDeck", deckId: activeEncounterDeckId(start) } });
    expect(times(events, shuffled)).toBe(1);
    expect(times(events, token)).toBe(1);
    expect(times(events, counted(t.wheel))).toBe(1);
    expect(state.pendingDeckRunOuts).toBeUndefined();
    expectReplays(session);
  });

  it("a deal that leaves one card in the deck resets nothing (near miss)", () => {
    const t = table([LAST.id, ...copiesOf(BLANK.id, 3)]);
    const [last] = t.ids(LAST.id);
    const blanks = t.ids(BLANK.id);
    const start = withEncounterPiles(t.state, { deck: [last!, blanks[0]!], discard: blanks.slice(1) });

    const { state, events } = playFree(start, LISTENING, DEAL.card.id);
    expect(activeEncounterDeck(state)).toEqual({ deck: [blanks[0]], discard: blanks.slice(1) });
    expect(tokens(state)).toBe(tokens(start));
    expect(resets(state, t.wheel)).toBe(0);
    expect(times(events, shuffled)).toBe(0);
  });

  it("a boost card that is the last card: the deck resets as it is dealt, and it is not in the new deck", () => {
    const t = table([LAST.id, ...copiesOf(BLANK.id, 3)]);
    const [last] = t.ids(LAST.id);
    const blanks = t.ids(BLANK.id);
    const start = withEncounterPiles(t.state, { deck: [last!], discard: blanks });

    const { state, events, session } = playFree(start, LISTENING, BOOST.card.id);
    expect(locateCard(state, last!)).toMatchObject({ kind: "boost" });
    expect(sorted(activeEncounterDeck(state).deck)).toEqual(blanks);
    expect(activeEncounterDeck(state).discard).toEqual([]);
    expect(tokens(state)).toBe(tokens(start) + 1);
    expect(resets(state, t.wheel)).toBe(1);
    const dealt = indexAfter(events, -1, "boost", movedTo(last!, "boost"));
    indexAfter(events, indexAfter(events, dealt, "shuffle", shuffled), "token", token);
    expectReplays(session);
  });

  it("a discard that empties the deck: it resets at that discard, with the discarded cards, and stops (p. 17)", () => {
    const t = table([LAST.id, ...copiesOf(BLANK.id, 4)]);
    const [last] = t.ids(LAST.id);
    const blanks = t.ids(BLANK.id);
    const start = withEncounterPiles(t.state, { deck: [last!, blanks[0]!], discard: blanks.slice(1) });

    const { state, events, session } = playFree(start, LISTENING, DISCARD_THREE.card.id);
    // Two discarded, not three: the effect does not continue with the newly shuffled deck. All five are in it.
    expect(times(events, (e) => e.type === "cardMoved" && e.from.kind === "encounterDeck")).toBe(2);
    expect(sorted(activeEncounterDeck(state).deck)).toEqual(sorted([last!, ...blanks]));
    expect(activeEncounterDeck(state).discard).toEqual([]);
    expect(tokens(state)).toBe(tokens(start) + 1);
    expect(resets(state, t.wheel)).toBe(1);
    const final = indexAfter(events, -1, "second discard", movedTo(blanks[0]!, "encounterDiscard"));
    indexAfter(events, indexAfter(events, final, "shuffle", shuffled), "token", token);
    expect(times(events, shuffled)).toBe(1);
    expectReplays(session);
  });

  it("a search that takes the last card out of the deck resets it", () => {
    const t = table([GOON.id, ...copiesOf(BLANK.id, 3)]);
    const [goon] = t.ids(GOON.id);
    const blanks = t.ids(BLANK.id);
    const start = withEncounterPiles(t.state, { deck: [goon!], discard: blanks });

    const { state, events, session } = playFree(start, LISTENING, SEARCH.card.id);
    expect(mustPlayer(state, P1).playArea).toContain(goon);
    expect(sorted(activeEncounterDeck(state).deck)).toEqual(blanks);
    expect(activeEncounterDeck(state).discard).toEqual([]);
    expect(tokens(state)).toBe(tokens(start) + 1);
    expect(resets(state, t.wheel)).toBe(1);
    const taken = indexAfter(events, -1, "take", movedFrom(goon!, "encounterDeck"));
    indexAfter(events, indexAfter(events, taken, "shuffle", shuffled), "token", token);
    expectReplays(session);
  });

  it("ruling Apr 30, 2026 (3) #7: the deck resets before the resolving card is discarded, so it is not in the new deck", () => {
    const t = table([LAST.id, ...copiesOf(BLANK.id, 3)]);
    const [last] = t.ids(LAST.id);
    const blanks = t.ids(BLANK.id);
    const start = withEncounterPiles(t.state, { deck: [last!], discard: blanks });

    const { state, events, session } = playFree(start, LISTENING, REVEAL.card.id);
    // The revealed treachery is the whole of the new discard pile; the new deck is the old discard pile exactly.
    expect(activeEncounterDeck(state).discard).toEqual([last]);
    expect(sorted(activeEncounterDeck(state).deck)).toEqual(blanks);
    expect(tokens(state)).toBe(tokens(start) + 1);
    expect(resets(state, t.wheel)).toBe(1);
    const left = indexAfter(events, -1, "reveal", movedFrom(last!, "encounterDeck"));
    const shuffle = indexAfter(events, left, "shuffle", shuffled);
    const placed = indexAfter(events, shuffle, "token", token);
    const response = indexAfter(events, placed, "forced response", counted(t.wheel));
    indexAfter(events, response, "discard of the resolving card", movedTo(last!, "encounterDiscard"));
    expect(times(events, shuffled)).toBe(1);
    expectReplays(session);
  });

  it("the Forced Response fires once per reset, and never for a deck that only shrank", () => {
    const t = table([LAST.id, ...copiesOf(BLANK.id, 2)]);
    const [last] = t.ids(LAST.id);
    const blanks = t.ids(BLANK.id);
    const start = withEncounterPiles(t.state, { deck: [last!], discard: blanks });

    // Reset 1: the deal takes the last card; the new deck is the two blanks.
    const first = playFree(start, LISTENING, DEAL.card.id);
    expect(resets(first.state, t.wheel)).toBe(1);
    // One of two discarded: no reset.
    const second = playFree(first.state, LISTENING, DISCARD_ONE.card.id);
    expect(resets(second.state, t.wheel)).toBe(1);
    expect(tokens(second.state)).toBe(tokens(start) + 1);
    expect(activeEncounterDeck(second.state).deck).toHaveLength(1);
    // Reset 2: the last one discarded; both blanks are the new deck.
    const third = playFree(second.state, LISTENING, DISCARD_ONE.card.id);
    expect(resets(third.state, t.wheel)).toBe(2);
    expect(tokens(third.state)).toBe(tokens(start) + 2);
    expect(sorted(activeEncounterDeck(third.state).deck)).toEqual(blanks);
    expect(times(third.events, counted(t.wheel))).toBe(1);
    // An encounter deck is not a player's deck.
    expect(mustInstance(third.state, t.wheel).counters.playerDecks).toBeUndefined();
    expectReplays(third.session);
  });

  it("a one-card deck with no discard pile, discarded from: the card is the whole new deck, with one token", () => {
    const t = table([LAST.id, BLANK.id]);
    const [last] = t.ids(LAST.id);
    const alone = withEncounterPiles(t.state, { deck: [last!], discard: [] });
    const discarded = playFree(alone, LISTENING, DISCARD_ONE.card.id);
    expect(discarded.state.outcome).toBeNull();
    expect(activeEncounterDeck(discarded.state)).toEqual({ deck: [last], discard: [] });
    expect(tokens(discarded.state)).toBe(tokens(alone) + 1);
    expect(resets(discarded.state, t.wheel)).toBe(1);
    const reached = indexAfter(discarded.events, -1, "discard", movedTo(last!, "encounterDiscard"));
    indexAfter(discarded.events, reached, "shuffle", shuffled);
    expectReplays(discarded.session);
  });

  it("nothing is recorded or announced when no ability listens: same piles, same token, no trigger", () => {
    const heard = table([LAST.id, ...copiesOf(BLANK.id, 3)]);
    const deaf = table([LAST.id, ...copiesOf(BLANK.id, 3)], DEAF);
    const arrange = (t: Table): GameState =>
      withEncounterPiles(t.state, { deck: [t.ids(LAST.id)[0]!], discard: t.ids(BLANK.id) });

    const withListener = playFree(arrange(heard), LISTENING, DEAL.card.id);
    const without = playFree(arrange(deaf), DEAF, DEAL.card.id);
    expect(without.state.pendingDeckRunOuts).toBeUndefined();
    expect(without.state.encounterDecks).toEqual(withListener.state.encounterDecks);
    expect(tokens(without.state)).toBe(tokens(withListener.state));
    expect(resets(without.state, deaf.wheel)).toBe(0);
    // The listening game's log is the deaf game's log plus the Forced Response's own events, straight after the token
    // (frame ids differ after them, so the tail is compared by event type).
    const placed = withListener.events.findIndex(token);
    expect(without.events.slice(0, placed + 1)).toEqual(withListener.events.slice(0, placed + 1));
    const extra = withListener.events.length - without.events.length;
    expect(extra).toBeGreaterThan(0);
    const types = (events: readonly GameEvent[]) => events.map((e) => e.type);
    expect(types(without.events.slice(placed + 1))).toEqual(types(withListener.events.slice(placed + 1 + extra)));
    const response = withListener.events.slice(placed + 1, placed + 1 + extra);
    expect(response).toContainEqual(
      expect.objectContaining({ type: "counterAdded", instanceId: heard.wheel, counterType: "resets" }),
    );
    const announced = (e: GameEvent) => e.type === "triggerEvent" && e.event.kind === "deckRanOut";
    expect(response.filter(announced).map((e) => (e.type === "triggerEvent" ? e.event : null))[0]).toEqual({
      kind: "deckRanOut",
      deck: "encounter",
      deckId: activeEncounterDeckId(withListener.state),
    });
    expect(times(without.events, announced)).toBe(0);
    expectReplays(without.session, DEAF);
  });
});

/**
 * Owner decision, 2026-10-03 (docs/phase7-wave6.md §4.1 Q57), RRG 1.8 "Encounter Deck" (p. 17): "If there are no cards
 * in both the encounter deck and the encounter discard pile simultaneously (such as all cards from the encounter deck
 * being in play), an infinite loop occurs with an infinite number of acceleration tokens being placed next to the main
 * scheme deck. If this happens, the players lose." Checked once the card that left the deck is where it was going.
 */
describe("owner decision Q57 (RRG 1.8 p. 17): an empty encounter deck with an empty discard pile loses the game", () => {
  const LOSS = { result: "loss", reason: "encounterDeckExhausted" } as const;
  const ended = (e: GameEvent) => e.type === "gameEnded";

  /** The last card of the deck, with no discard pile, taken by `by`: the players lose at that move. */
  function losesAt(by: { card: { id: CardId } }, card: { id: CardId }, to: string) {
    const t = table([card.id, BLANK.id]);
    const [last] = t.ids(card.id);
    const start = withEncounterPiles(t.state, { deck: [last!], discard: [] });
    const { state, events, session } = playFree(start, LISTENING, by.card.id);
    expect(state.outcome).toEqual(LOSS);
    expect(state.step).toEqual({ phase: "gameOver", kind: "gameOver" });
    expect(events).toContainEqual({ type: "gameEnded", outcome: LOSS });
    // The card reached where it was going, and the game ended there: no shuffle, no token, no Forced Response.
    const moved = indexAfter(events, -1, "move out of the deck", movedTo(last!, to));
    expect(events[moved]).toMatchObject({ from: { kind: "encounterDeck" } });
    indexAfter(events, moved, "game end", ended);
    expect(times(events, shuffled)).toBe(0);
    expect(tokens(state)).toBe(tokens(start));
    expect(resets(state, t.wheel)).toBe(0);
    expect(activeEncounterDeck(state)).toEqual({ deck: [], discard: [] });
    expectReplays(session);
    return { state, events, last: last! };
  }

  it("the last card dealt facedown to a player, with no discard pile: the players lose", () => {
    const { state, last } = losesAt(DEAL, LAST, "dealtEncounter");
    expect(mustPlayer(state, P1).dealtEncounter).toEqual([last]);
  });

  it("the last card given as a boost card, with no discard pile: the players lose", () => {
    losesAt(BOOST, LAST, "boost");
  });

  it("the last card revealed, with no discard pile: the players lose before it resolves or is discarded", () => {
    const { events, last } = losesAt(REVEAL, LAST, "dealtEncounter");
    expect(times(events, movedTo(last, "encounterDiscard"))).toBe(0);
    expect(times(events, (e) => e.type === "encounterCardRevealed")).toBe(0);
  });

  it("the last card put into play from the deck (all cards in play), with no discard pile: the players lose", () => {
    const { state, last } = losesAt(SEARCH, GOON, "playArea");
    expect(mustPlayer(state, P1).playArea).toContain(last);
  });

  it("a deal that needs more cards than the deck has, with no discard pile, ends at the last card", () => {
    const t = table([LAST.id, BLANK.id]);
    const [last] = t.ids(LAST.id);
    const start = withEncounterPiles(t.state, { deck: [last!], discard: [] });
    const { state, events } = playFree(start, LISTENING, DEAL_THREE.card.id);
    expect(state.outcome).toEqual(LOSS);
    expect(mustPlayer(state, P1).dealtEncounter).toEqual([last]);
    expect(times(events, ended)).toBe(1);
  });

  it("near miss: a discard pile of one card is a reset, not a loss", () => {
    const t = table([LAST.id, BLANK.id]);
    const [last] = t.ids(LAST.id);
    const [blank] = t.ids(BLANK.id);
    const start = withEncounterPiles(t.state, { deck: [last!], discard: [blank!] });
    const { state } = playFree(start, LISTENING, DEAL.card.id);
    expect(state.outcome).toBeNull();
    expect(activeEncounterDeck(state)).toEqual({ deck: [blank], discard: [] });
    expect(tokens(state)).toBe(tokens(start) + 1);
  });

  it("near miss: a deck with a card left and no discard pile is neither", () => {
    const t = table([LAST.id, BLANK.id]);
    const [last] = t.ids(LAST.id);
    const [blank] = t.ids(BLANK.id);
    const start = withEncounterPiles(t.state, { deck: [last!, blank!], discard: [] });
    const { state } = playFree(start, LISTENING, DEAL.card.id);
    expect(state.outcome).toBeNull();
    expect(activeEncounterDeck(state)).toEqual({ deck: [blank], discard: [] });
    expect(tokens(state)).toBe(tokens(start));
  });

  it("a discard from the deck that empties it never loses: the card is in the discard pile when the deck is checked", () => {
    const t = table([LAST.id, BLANK.id]);
    const [last] = t.ids(LAST.id);
    const start = withEncounterPiles(t.state, { deck: [last!], discard: [] });
    const { state } = playFree(start, LISTENING, DISCARD_THREE.card.id);
    expect(state.outcome).toBeNull();
    expect(activeEncounterDeck(state)).toEqual({ deck: [last], discard: [] });
    expect(tokens(state)).toBe(tokens(start) + 1);
  });

  it("scenario setup is not checked: a setup ability that takes the deck's only card out of it does not lose", () => {
    const TAKE = stubAbility("take.setup", {
      trigger: { kind: "setup" },
      effects: [
        { kind: "selectCards", slot: "found", cards: { kind: "encounter", zones: ["deck"], filter: { name: "goon" } } },
        { kind: "putIntoPlay", card: { kind: "slot", slot: "found" }, controller: { kind: "firstPlayer" } },
      ],
    });
    const SCHEME = stubMainScheme({
      id: "setup-takes-all",
      stages: [
        {
          startingThreat: flat(0),
          targetThreat: flat(99),
          acceleration: flat(0),
          aSideAbilities: [TAKE.ref],
        },
      ],
    });
    const deps = depsOf(TAKE);
    const result = createGame(
      {
        seed: 9,
        cards: [...DEFAULT_CARDS, SCHEME, GOON],
        villainCardId: DEFAULT_CARDS.find((card) => card.type === "villain")!.id,
        mainSchemeCardId: SCHEME.id,
        encounterDeck: [GOON.id],
        includeIdentitySets: false,
        players: [{ identityCardId: HERO.id, deck: DEFAULT_DECK }],
      },
      deps,
    );
    if (!result.ok) throw new Error(result.error.message);
    const state = driveSession(startSession(result.state), deps).session.state;
    expect(activeEncounterDeck(state)).toEqual({ deck: [], discard: [] });
    expect(mustPlayer(state, P1).playArea.map((id) => mustInstance(state, id).cardId)).toContain(GOON.id);
    expect(state.outcome).toBeNull();
    expect(state.step).toMatchObject({ phase: "player", kind: "turn" });
  });
});

describe("§3.60 several encounter decks (The Wrecking Crew): only the emptied deck resets", () => {
  const WRECKER = stubVillain({ id: "wrecker", stages: [{ hp: flat(5), atk: 0, sch: 0 }] });
  const THUNDERBALL = stubVillain({ id: "thunderball", stages: [{ hp: flat(5), atk: 0, sch: 0 }] });
  const BREAKOUT = stubMainScheme({
    id: "breakout",
    stages: [{ startingThreat: flat(0), targetThreat: flat(99), acceleration: flat(0) }],
  });
  const OTHER = stubTreachery({ id: "other-deck-card", boostIcons: 0 });

  function crew(listeners: (decks: readonly EncounterDeckId[]) => readonly StubAbility[]) {
    // Deck ids are setup's own; read them from a first build, then build again with the listeners that name them.
    const build = (abilities: readonly StubAbility[]) => {
      const deps = depsOf(...abilities, ...EVENTS.map((e) => e.ability));
      const board = stubEnvironment({ id: "board", abilities: abilities.map((a) => a.ref) });
      const result = createGame(
        {
          seed: 5,
          cards: [
            ...DEFAULT_CARDS,
            WRECKER,
            THUNDERBALL,
            BREAKOUT,
            board,
            BLANK,
            LAST,
            OTHER,
            ...EVENTS.map((e) => e.card),
          ],
          villainCardId: WRECKER.id,
          villains: [
            { villainCardId: WRECKER.id, encounterDeck: [board.id, LAST.id, ...copiesOf(BLANK.id, 3)] },
            { villainCardId: THUNDERBALL.id, encounterDeck: copiesOf(OTHER.id, 4) },
          ],
          mainSchemeCardId: BREAKOUT.id,
          encounterDeck: [],
          includeIdentitySets: false,
          players: [{ identityCardId: HERO.id, deck: [...DEFAULT_DECK, ...copiesOf(DEAL.card.id, 2)] }],
        },
        deps,
      );
      if (!result.ok) throw new Error(result.error.message);
      const state = driveSession(startSession(result.state), deps).session.state;
      const placed = encounterCardInVillainArea(state, board.id);
      return { state: placed.state, board: placed.id, deps };
    };
    const decks = Object.keys(build([]).state.encounterDecks) as EncounterDeckId[];
    return { ...build(listeners(decks)), decks };
  }

  it("the active villain's deck resets alone, and the event names that deck", () => {
    const {
      state: base,
      board,
      deps,
      decks,
    } = crew(([mine, theirs]) => [
      stubAbility("board.mine", {
        trigger: {
          kind: "response",
          forced: true,
          on: { on: "deckRanOut", eventIs: { deck: "encounter", deckId: mine! } },
        },
        effects: [count("mine")],
      }),
      stubAbility("board.theirs", {
        trigger: {
          kind: "response",
          forced: true,
          on: { on: "deckRanOut", eventIs: { deck: "encounter", deckId: theirs! } },
        },
        effects: [count("theirs")],
      }),
    ]);
    const [mine, theirs] = decks;
    expect(decks).toHaveLength(2);
    expect(activeEncounterDeckId(base)).toBe(mine);
    const ofCard = (card: CardId) =>
      Object.values(base.instances)
        .filter((i) => i.cardId === card)
        .map((i) => i.instanceId)
        .sort();
    const [last] = ofCard(LAST.id);
    const blanks = ofCard(BLANK.id);
    const others = ofCard(OTHER.id);
    // The other villain's deck is empty with a discard pile (a state built by hand): this deal must not touch it.
    const start: GameState = {
      ...base,
      encounterDecks: {
        ...base.encounterDecks,
        [mine!]: { deck: [last!], discard: blanks },
        [theirs!]: { deck: [], discard: others },
      },
    };

    const { state, events, session } = playFree(start, deps, DEAL.card.id);
    expect(mustPlayer(state, P1).dealtEncounter).toEqual([last]);
    expect(sorted(state.encounterDecks[mine!]!.deck)).toEqual(blanks);
    expect(state.encounterDecks[mine!]!.discard).toEqual([]);
    expect(state.encounterDecks[theirs!]).toEqual({ deck: [], discard: others });
    expect(tokens(state)).toBe(tokens(start) + 1);
    expect(events.filter(shuffled)).toEqual([
      expect.objectContaining({ zone: { kind: "encounterDeck", deckId: mine } }),
    ]);
    expect(mustInstance(state, board).counters).toMatchObject({ mine: 1 });
    expect(mustInstance(state, board).counters.theirs).toBeUndefined();
    const replayed = replay(session.log, deps);
    if (!replayed.ok) throw new Error(replayed.error.message);
    expect(replayed.state).toEqual(session.state);
  });

  it("owner decision Q57 (RRG 1.8 p. 17): a villain's deck emptied with no discard pile of its own loses, whatever the other deck holds", () => {
    const { state: base, deps, decks } = crew(() => []);
    const [mine, theirs] = decks;
    const last = Object.values(base.instances).find((i) => i.cardId === LAST.id)!.instanceId;
    const start: GameState = {
      ...base,
      encounterDecks: { ...base.encounterDecks, [mine!]: { deck: [last], discard: [] } },
    };
    expect(start.encounterDecks[theirs!]!.deck.length).toBeGreaterThan(0);

    const { state, session } = playFree(start, deps, DEAL.card.id);
    expect(state.outcome).toEqual({ result: "loss", reason: "encounterDeckExhausted" });
    expect(state.encounterDecks[theirs!]).toEqual(start.encounterDecks[theirs!]);
    expect(tokens(state)).toBe(tokens(start));
    const replayed = replay(session.log, deps);
    if (!replayed.ok) throw new Error(replayed.error.message);
    expect(replayed.state).toEqual(session.state);
  });
});
