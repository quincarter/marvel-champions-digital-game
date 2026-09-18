import { describe, expect, test } from "vitest";
import { CORE_POOL_VERSION, CORE_STARTER_DECKS, deckFromStarterDeck, deckId } from "@mc/content";
import { corePlayerForSeat, corePlayerFromDeck } from "./deck-seat.js";
import { deckOptionOf, preconDecks } from "./deck-list-model.js";
import { POOL_CARDS, POOL_DEPS, POOL_VERSION } from "../content/pool.js";

describe("corePlayerFromDeck", () => {
  test("flattens quantities into one entry per copy, same as starterDeckSetup", () => {
    const starter = CORE_STARTER_DECKS[0]!;
    const deck = deckFromStarterDeck(starter, CORE_POOL_VERSION);
    const player = corePlayerFromDeck(deck);

    expect(player).toEqual({
      identityCardId: starter.identityCardId,
      aspects: starter.aspects,
      deck: starter.cards.flatMap(({ cardId, quantity }) => Array.from({ length: quantity }, () => cardId)),
      deckId: deck.id,
    });
  });

  test("an empty deck flattens to an empty card list, not an error", () => {
    const starter = CORE_STARTER_DECKS[0]!;
    const deck = { ...deckFromStarterDeck(starter, CORE_POOL_VERSION), cards: [] };
    expect(corePlayerFromDeck(deck)).toEqual({ identityCardId: starter.identityCardId, aspects: starter.aspects, deck: [], deckId: deck.id });
  });

  // S4 (docs/phase4-screen-gaps.md §2): `deckId` is the seat's own attribution key — this
  // build's local deck-storage id, opaque to everything downstream of this function.
  test("deckId is the deck's own storage id, carried through verbatim", () => {
    const starter = CORE_STARTER_DECKS[0]!;
    const deck = { ...deckFromStarterDeck(starter, CORE_POOL_VERSION), id: deckId("user-built-123") };
    const player = corePlayerFromDeck(deck);
    if ("starterDeckId" in player) throw new Error("corePlayerFromDeck never returns a precon seat");
    expect(player.deckId).toBe("user-built-123");
  });
});

describe("corePlayerForSeat", () => {
  test("a precon option stays { starterDeckId }, never re-derived from Deck.cards", () => {
    const option = deckOptionOf(preconDecks(POOL_VERSION)[0]!, POOL_CARDS, POOL_VERSION, POOL_DEPS);
    const player = corePlayerForSeat(option);
    expect(player).toEqual({ starterDeckId: option.deck.source.kind === "precon" ? option.deck.source.starterDeckId : undefined });
  });

  test("a custom deck option goes through corePlayerFromDeck", () => {
    const starter = CORE_STARTER_DECKS[0]!;
    const deck = { ...deckFromStarterDeck(starter, CORE_POOL_VERSION), id: deckId("user-built-456"), source: { kind: "userBuilt" as const, createdAt: "2026-01-01" } };
    const option = deckOptionOf(deck, POOL_CARDS, POOL_VERSION, POOL_DEPS);
    expect(corePlayerForSeat(option)).toEqual(corePlayerFromDeck(deck));
  });
});
