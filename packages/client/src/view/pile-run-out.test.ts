/** Piles the next round will empty (issue #769): the tint flips on at the right count. */

import { describe, expect, test } from "vitest";
import type { GameState } from "@mc/engine";
import { activeEncounterDeck, handSize } from "@mc/engine";
import { LocalEngineHost } from "../engine/local-host.js";
import { SessionStore } from "../store/session-store.js";
import { POOL_DEPS } from "../content/pool.js";
import { boardModel } from "./board-model.js";
import { encounterDemandOf, encounterRunsOut, playerDeckRunsOut } from "./pile-run-out.js";

async function rhinoGame(): Promise<{ state: GameState; store: SessionStore }> {
  const store = new SessionStore(new LocalEngineHost());
  await store.start({
    scenarioId: "rhino",
    difficulty: "standard",
    players: [{ starterDeckId: "core-spider-man-justice" }],
    seed: 7,
  });
  return { state: store.state.game!, store };
}

function withEncounterDeck(state: GameState, length: number): GameState {
  const id = state.villains[0]!.encounterDeckId;
  const deck = state.encounterDecks[id]!;
  return {
    ...state,
    encounterDecks: { ...state.encounterDecks, [id]: { ...deck, deck: deck.deck.slice(0, length) } },
  };
}

describe("encounter deck run-out (#769)", () => {
  test("flips on when the next villain phase needs more cards than the deck holds", async () => {
    const { state, store } = await rhinoGame();
    const { total } = encounterDemandOf(state, POOL_DEPS);
    expect(total).toBeGreaterThanOrEqual(2); // a boost card and an encounter card for one player
    expect(activeEncounterDeck(state).deck.length).toBeGreaterThan(total);
    expect(encounterRunsOut(state, POOL_DEPS)).toBe(false);
    // Taking exactly the last card empties the deck, which resets it then and there (RRG 1.8 "Encounter Deck", p. 17).
    expect(encounterRunsOut(withEncounterDeck(state, total + 1), POOL_DEPS)).toBe(false);
    const low = withEncounterDeck(state, total);
    expect(encounterRunsOut(low, POOL_DEPS)).toBe(true);
    expect(boardModel(low, store.state.perspectiveId!, POOL_DEPS).encounterRunsOut).toBe(true);
  });
});

describe("player deck run-out (#769)", () => {
  /** The game with `hand` cards in hand (the rest moved to the deck's bottom) and the deck cut to `deck` cards. */
  function withHandAndDeck(state: GameState, hand: number, deck: number): GameState {
    return {
      ...state,
      players: state.players.map((p) => {
        const cards = [...p.hand, ...p.deck];
        return { ...p, hand: cards.slice(0, hand), deck: cards.slice(hand, hand + deck) };
      }),
    };
  }

  test("counts only the cards the end-of-round draw still needs: hand size less the hand", async () => {
    const { state, store } = await rhinoGame();
    const me = store.state.perspectiveId!;
    const size = handSize(state, me, POOL_DEPS);
    expect(size).toBeGreaterThanOrEqual(3);
    expect(state.players[0]!.hand.length + state.players[0]!.deck.length).toBeGreaterThan(size + 1);
    expect(playerDeckRunsOut(state, POOL_DEPS, me)).toBe(false);
    // An empty hand draws the whole hand size.
    // Drawing exactly the last card empties the deck: it reshuffles then (RRG 1.8 "Player Deck", p. 33).
    expect(playerDeckRunsOut(withHandAndDeck(state, 0, size + 1), POOL_DEPS, me)).toBe(false);
    const low = withHandAndDeck(state, 0, size);
    expect(playerDeckRunsOut(low, POOL_DEPS, me)).toBe(true);
    expect(boardModel(low, me, POOL_DEPS).myDeckRunsOut).toBe(true);
    // Holding 2 cards, the draw needs size − 2: one card more than that is left over, exactly that empties the deck.
    expect(playerDeckRunsOut(withHandAndDeck(state, 2, size - 1), POOL_DEPS, me)).toBe(false);
    expect(playerDeckRunsOut(withHandAndDeck(state, 2, size - 2), POOL_DEPS, me)).toBe(true);
    // A full hand draws nothing, so even an empty deck is not run out by the draw.
    expect(playerDeckRunsOut(withHandAndDeck(state, size, 0), POOL_DEPS, me)).toBe(false);
  });
});
