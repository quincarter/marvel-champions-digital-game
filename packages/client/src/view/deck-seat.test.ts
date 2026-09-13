import { describe, expect, test } from "vitest";
import { CORE_POOL_VERSION, CORE_STARTER_DECKS, deckFromStarterDeck } from "@mc/content";
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
    });
  });

  test("an empty deck flattens to an empty card list, not an error", () => {
    const starter = CORE_STARTER_DECKS[0]!;
    const deck = { ...deckFromStarterDeck(starter, CORE_POOL_VERSION), cards: [] };
    expect(corePlayerFromDeck(deck)).toEqual({ identityCardId: starter.identityCardId, aspects: starter.aspects, deck: [] });
  });
});
