/**
 * Rules-QA 2026-10-03, changes 3-5 (commits 6f5d0ec3, cfdf6d92, c7fea75a, 528afd17; owner decisions Q57, Q58, Q54), in
 * real games on real scenarios.
 *
 * - RRG 1.8 "Encounter Deck" (p. 17): "If the encounter deck is empty, the encounter discard pile is immediately
 *   shuffled to create a new encounter deck. When this occurs, place an acceleration token next to the main scheme
 *   deck."; "If the encounter deck empties during the resolution of any other type of game effect (for example, the
 *   dealing of encounter cards), that effect finishes resolving after the encounter deck has been reset."; "If there
 *   are no cards in both the encounter deck and the encounter discard pile simultaneously (such as all cards from the
 *   encounter deck being in play), an infinite loop occurs ... If this happens, the players lose."
 * - Ruling January 17, 2026 (5): in The Wrecking Crew (Breakout) "only the active villain's encounter deck can be
 *   interacted with", so the both-empty check is of the deck the card left, and each villain's deck has its own discard.
 */
import { activeEncounterDeck, activeEncounterDeckId, type GameEvent, type GameState } from "@mc/engine";
import { describe, expect, it, vi } from "vitest";
import { endTurn, P1, P2, patchInstance } from "./testing/harness.js";
import { drive, rhino } from "./testing/qa-bench.js";
import { withForm } from "./testing/staging.js";

vi.setConfig({ testTimeout: 60_000 });

const of = <T extends GameEvent["type"]>(events: readonly GameEvent[], type: T) =>
  events.filter((e): e is Extract<GameEvent, { type: T }> => e.type === type);
const tokens = (state: GameState): number => state.mainScheme.accelerationTokens;

/** The active villain's encounter deck set to exactly `deck` over `discard` (ids taken from what the game dealt out). */
function withPiles(state: GameState, deckSize: number, discardSize: number): GameState {
  const id = activeEncounterDeckId(state);
  const pile = activeEncounterDeck(state);
  const all = [...pile.deck, ...pile.discard];
  return {
    ...state,
    encounterDecks: {
      ...state.encounterDecks,
      [id]: { deck: all.slice(0, deckSize), discard: all.slice(deckSize, deckSize + discardSize) },
    },
  };
}
const quiet = (state: GameState): GameState => patchInstance(state, state.mainScheme.instanceId, { threat: 0 });

describe("Q57 (RRG p. 17): an encounter deck and its discard pile both empty lose the game (Rhino, real game)", () => {
  it("the villain's boost card is the last card in the game's encounter cards: the players lose", () => {
    const state = withPiles(quiet(rhino()), 1, 0);
    const done = drive(state, endTurn(P1));
    expect(done.state.outcome).toEqual({ result: "loss", reason: "encounterDeckExhausted" });
    expect(of(done.events, "gameEnded")).toHaveLength(1);
  });

  it("near miss: the same last card with a discard pile is a reset (a token, no loss)", () => {
    const state = withPiles(quiet(rhino()), 1, 8);
    const done = drive(state, endTurn(P1));
    expect(done.state.outcome).toBeNull();
    expect(tokens(done.state)).toBeGreaterThan(tokens(state));
  });

  it("two cards and no discard pile: the cards run out in the villain phase and the players lose", () => {
    const state = withPiles(quiet(rhino()), 2, 0);
    const done = drive(state, endTurn(P1));
    expect(done.state.outcome).toEqual({ result: "loss", reason: "encounterDeckExhausted" });
  });
});

describe("Q58 (RRG p. 17): a deal that empties the deck finishes after the reset (Rhino, 2 players, no listener)", () => {
  it("the first player is dealt the last card, the deck resets, and the second player is dealt from the new deck", () => {
    // Both heroes in alter-ego form: Rhino schemes twice (two boost cards, which then sit in the discard pile), leaving
    // exactly one card for a deal of two.
    let state = rhino(1, "core-spider-man-justice", "rhino", ["core-captain-marvel-leadership"]);
    state = withForm(withForm(quiet(state), "alterEgo"), "alterEgo", P2);
    state = withPiles(state, 3, 0);
    const start = tokens(state);
    const first = drive(state, endTurn(P1));
    const second = drive(first.state, endTurn(P2));
    const events = [...first.events, ...second.events];
    const dealtTo = (player: string) => (e: GameEvent) =>
      e.type === "cardMoved" &&
      e.from.kind === "encounterDeck" &&
      e.to.kind === "dealtEncounter" &&
      e.to.playerId === player;
    const p1 = events.findIndex(dealtTo(P1));
    const p2 = events.findIndex(dealtTo(P2));
    const shuffled = events.findIndex((e, i) => i > p1 && e.type === "deckShuffled" && e.zone.kind === "encounterDeck");
    expect(p1).toBeGreaterThanOrEqual(0);
    expect(shuffled).toBeGreaterThan(p1);
    expect(p2).toBeGreaterThan(shuffled);
    expect(tokens(second.state)).toBe(start + 1);
    // Both players hold a dealt card: the deal was not cut short.
    expect(second.state.outcome).toBeNull();
  });
});

describe("Q57 in The Wrecking Crew (Breakout): the check is per villain deck (ruling Jan 17, 2026 (5))", () => {
  const crew = (): { readonly state: GameState; readonly mine: string; readonly others: readonly string[] } => {
    const state = quiet(rhino(1, "core-spider-man-justice", "breakout"));
    const mine = state.villains.find((v) => v.instanceId === state.activeVillainId)!.encounterDeckId!;
    const others = state.villains.map((v) => v.encounterDeckId!).filter((id) => id !== mine);
    return { state, mine, others };
  };
  const piles = (state: GameState, id: string) => state.encounterDecks[id]!;

  it("the active villain's deck down to its last card with no discard pile loses, though the other villains' decks are full", () => {
    const { state, mine, others } = crew();
    expect(others).toHaveLength(3);
    const own = piles(state, mine);
    const start: GameState = {
      ...state,
      encounterDecks: {
        ...state.encounterDecks,
        [mine]: { deck: [...own.deck, ...own.discard].slice(0, 1), discard: [] },
      },
    };
    for (const id of others) expect(piles(start, id).deck.length).toBeGreaterThan(0);
    const done = drive(start, endTurn(P1));
    expect(done.state.outcome).toEqual({ result: "loss", reason: "encounterDeckExhausted" });
    // Nothing was borrowed from, or reset in, the other villains' decks.
    for (const id of others) expect(piles(done.state, id)).toEqual(piles(start, id));
  });

  it("near miss: a villain that is not active with an empty deck and discard pile loses nobody the game", () => {
    const { state, others } = crew();
    const start: GameState = {
      ...state,
      encounterDecks: { ...state.encounterDecks, [others[0]!]: { deck: [], discard: [] } },
    };
    const done = drive(start, endTurn(P1));
    expect(done.state.outcome).toBeNull();
    expect(piles(done.state, others[0]!)).toEqual({ deck: [], discard: [] });
  });
});
