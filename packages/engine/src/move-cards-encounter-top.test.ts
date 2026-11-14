/**
 * `EffectSpec moveCards.encounterTop` (docs/phase7-elektra-iron-fist.md §5, Double-Cross 63034): "shuffle … into the top
 * 10 cards of the encounter deck (or the whole deck if there are fewer than 10 cards)". The moved cards and the top N
 * cards before them are shuffled together; the rest of the deck keeps its order. Synthetic cards: two encounter cards
 * moved by surgery into the set-aside area, then an event shuffles them into the top 3.
 */
import { describe, expect, it } from "vitest";
import { replay } from "./engine.js";
import type { EncounterDeckId, InstanceId } from "./ids.js";
import type { GameState } from "./state.js";
import { depsOf, stubAbility } from "./testing/abilities.js";
import { stubEvent } from "./testing/fixtures.js";
import { gameAtFirstTurn, playFree } from "./testing/wave3.js";

const INTO_TOP = stubAbility("into-top.action", {
  trigger: { kind: "action" },
  effects: [
    {
      kind: "moveCards",
      cards: { kind: "encounterSetAside" },
      to: "encounterDeckShuffle",
      encounterTop: { kind: "const", value: 3 },
    },
  ],
});
const INTO_TOP_CARD = stubEvent({ id: "into-top", cost: 0, abilities: [INTO_TOP.ref] });
const deps = depsOf(INTO_TOP);

/** The game with the encounter deck cut to `size` cards and its last two set aside. */
function table(size: number) {
  const state = gameAtFirstTurn({ cards: [INTO_TOP_CARD], deps, deck: [INTO_TOP_CARD.id] });
  const deckId = state.encounterDeckOrder[0] as EncounterDeckId;
  const deck = state.encounterDecks[deckId]!.deck.slice(0, size + 2);
  const aside = deck.slice(size);
  const cut: GameState = {
    ...state,
    encounterDecks: {
      ...state.encounterDecks,
      [deckId]: { ...state.encounterDecks[deckId]!, deck: deck.slice(0, size) },
    },
    encounterSetAside: [...state.encounterSetAside, ...aside],
  };
  return { state: cut, deckId, aside };
}
const sorted = (ids: readonly InstanceId[]) => [...ids].sort();

describe("moveCards encounterTop: shuffled into the top N cards of the encounter deck", () => {
  it("the moved cards and the 3 that were on top are the new top 5; the rest keep their order; replay deep-equal", () => {
    const { state, deckId, aside } = table(10);
    const before = state.encounterDecks[deckId]!.deck;
    const run = playFree(state, deps, INTO_TOP_CARD.id);
    const deck = run.state.encounterDecks[deckId]!.deck;
    expect(deck).toHaveLength(12);
    expect(sorted(deck.slice(0, 5))).toEqual(sorted([...before.slice(0, 3), ...aside]));
    expect(deck.slice(5)).toEqual(before.slice(3));
    expect(run.state.encounterSetAside.filter((id) => aside.includes(id))).toEqual([]);
    expect(run.events.some((e) => e.type === "deckShuffled" && e.zone.kind === "encounterDeck")).toBe(true);
    const replayed = replay(run.session.log, deps);
    if (!replayed.ok) throw new Error(replayed.error.message);
    expect(replayed.state).toEqual(run.session.state);
  });

  it("a deck of fewer than N cards is shuffled whole with them", () => {
    const { state, deckId, aside } = table(2);
    const before = state.encounterDecks[deckId]!.deck;
    const deck = playFree(state, deps, INTO_TOP_CARD.id).state.encounterDecks[deckId]!.deck;
    expect(sorted(deck)).toEqual(sorted([...before, ...aside]));
  });
});
