import { describe, expect, test } from "vitest";
import { CORE_POOL_VERSION, CORE_STARTER_DECKS, deckFromStarterDeck, deckId } from "@mc/content";
import { corePlayerFromDeck } from "./deck-seat.js";

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
