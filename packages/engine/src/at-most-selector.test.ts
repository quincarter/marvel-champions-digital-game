/**
 * docs/phase7-wave3.md §3.50: "search … for **one copy** of X" (`CardSelector atMost`). A synthetic event shaped like
 * MC16 p. 18's Ronan setup ("Search the encounter deck and discard pile for one copy of the Pincer Maneuver side
 * scheme"): the target card is printed in three copies, and a plain `encounter` selector names all three.
 *
 * Sources: RRG 1.8 "Search" (p. 39): when several cards satisfy a search, the searching player chooses among them;
 * `atMost` is for interchangeable copies and takes them in selector order (deck top-down, then discard). RRG 1.8
 * "Shuffle" (p. 39): a searched deck is shuffled afterwards, so which deck copy is taken is not observable.
 */

import { describe, expect, it } from "vitest";
import { replay } from "./engine.js";
import type { InstanceId } from "./ids.js";
import { activeEncounterDeck, activeEncounterDeckId, mustInstance } from "./query.js";
import type { CardSelector, EffectSpec } from "./spec.js";
import type { GameState } from "./state.js";
import { depsOf, stubAbility } from "./testing/abilities.js";
import { stubEvent, stubTreachery } from "./testing/fixtures.js";
import { TREACHERY } from "./testing/scenario.js";
import { copiesOf, gameAtFirstTurn, playFree } from "./testing/wave3.js";

const TARGET = stubTreachery({ id: "wanted" });
const both: CardSelector = { kind: "encounter", zones: ["deck", "discard"], filter: { name: TARGET.name } };
const found = { kind: "ref", ref: { kind: "slot", slot: "found" } } as const;

/** "Search the encounter deck and discard pile for `count` copies of Wanted and set them aside." */
function searchFor(count: number): EffectSpec[] {
  return [
    { kind: "selectCards", slot: "found", cards: { kind: "atMost", count: { kind: "const", value: count }, of: both } },
    { kind: "moveCards", cards: found, to: "encounterSetAside" },
  ];
}
const ONE = stubAbility("search-one.action", { trigger: { kind: "action" }, effects: searchFor(1) });
const TWO = stubAbility("search-two.action", { trigger: { kind: "action" }, effects: searchFor(2) });
const NONE = stubAbility("search-none.action", { trigger: { kind: "action" }, effects: searchFor(0) });
const SEARCH_ONE = stubEvent({ id: "search-one", cost: 0, abilities: [ONE.ref] });
const SEARCH_TWO = stubEvent({ id: "search-two", cost: 0, abilities: [TWO.ref] });
const SEARCH_NONE = stubEvent({ id: "search-none", cost: 0, abilities: [NONE.ref] });
const deps = depsOf(ONE, TWO, NONE);

function start(copies = 3): GameState {
  return gameAtFirstTurn({
    cards: [TARGET, SEARCH_ONE, SEARCH_TWO, SEARCH_NONE],
    deps,
    deck: [SEARCH_ONE.id, SEARCH_ONE.id, SEARCH_TWO.id, SEARCH_NONE.id],
    encounter: [...copiesOf(TARGET.id, copies), ...copiesOf(TREACHERY.id, 12)],
  });
}

/** The set-aside pile as a set: `moveCards` puts each card on top of it, so its order is not the search's order. */
const setAside = (state: GameState): readonly InstanceId[] => [...state.encounterSetAside].sort();
const sorted = (ids: readonly (InstanceId | undefined)[]): readonly (InstanceId | undefined)[] => [...ids].sort();

const isTarget = (state: GameState) => (id: InstanceId) => mustInstance(state, id).cardId === TARGET.id;

/** Test surgery before the session starts (so the replay reproduces it): moves `ids` to the encounter discard pile. */
function discardFromEncounterDeck(state: GameState, ids: readonly InstanceId[]): GameState {
  const deckId = activeEncounterDeckId(state);
  const piles = activeEncounterDeck(state);
  return {
    ...state,
    encounterDecks: {
      ...state.encounterDecks,
      [deckId]: { deck: piles.deck.filter((id) => !ids.includes(id)), discard: [...piles.discard, ...ids] },
    },
  };
}

/** Plays `card` and checks the log replays to the same state. */
function play(state: GameState, card: typeof SEARCH_ONE): GameState {
  const { session, state: after } = playFree(state, deps, card.id);
  const replayed = replay(session.log, deps);
  if (!replayed.ok) throw new Error(replayed.error.message);
  expect(replayed.state).toEqual(after);
  return after;
}

describe("§3.50 at most N: search for one copy", () => {
  it("takes one copy, the topmost in the deck, and leaves the other copies where they were", () => {
    const before = start();
    const deckBefore = activeEncounterDeck(before).deck;
    const copies = deckBefore.filter(isTarget(before));
    expect(copies).toHaveLength(3);
    const after = play(before, SEARCH_ONE);
    expect(after.encounterSetAside).toEqual([copies[0]]);
    // The deck is untouched apart from the copy taken (nothing here shuffles it).
    expect(activeEncounterDeck(after).deck).toEqual(deckBefore.filter((id) => id !== copies[0]));
  });

  it("a second, later search still finds a remaining copy", () => {
    const before = start();
    const copies = activeEncounterDeck(before).deck.filter(isTarget(before));
    const once = play(before, SEARCH_ONE);
    const twice = play(once, SEARCH_ONE);
    expect(setAside(twice)).toEqual(sorted([copies[0], copies[1]]));
    expect(activeEncounterDeck(twice).deck.filter(isTarget(twice))).toEqual([copies[2]]);
  });

  it("searches the deck before the discard pile, and the discard pile when the deck has none", () => {
    const before = start(2);
    const [inDeck, inDiscard] = activeEncounterDeck(before).deck.filter(isTarget(before));
    const split = discardFromEncounterDeck(before, [inDiscard!]);
    const first = play(split, SEARCH_ONE);
    expect(first.encounterSetAside).toEqual([inDeck]);
    expect(activeEncounterDeck(first).discard).toEqual([inDiscard]);
    const second = play(first, SEARCH_ONE);
    expect(setAside(second)).toEqual(sorted([inDeck, inDiscard]));
    expect(activeEncounterDeck(second).discard).toEqual([]);
  });

  it("takes fewer when fewer match, and nothing (with no error) when none do", () => {
    const one = start(1);
    const took = play(one, SEARCH_TWO);
    expect(took.encounterSetAside).toHaveLength(1);
    const none = play(took, SEARCH_ONE);
    expect(none.encounterSetAside).toEqual(took.encounterSetAside);
    expect(activeEncounterDeck(none).deck).toEqual(activeEncounterDeck(took).deck);
  });

  it("at most 2 takes two in order; at most 0 takes none", () => {
    const before = start();
    const copies = activeEncounterDeck(before).deck.filter(isTarget(before));
    expect(setAside(play(before, SEARCH_TWO))).toEqual(sorted(copies.slice(0, 2)));
    expect(play(before, SEARCH_NONE).encounterSetAside).toEqual([]);
  });
});
