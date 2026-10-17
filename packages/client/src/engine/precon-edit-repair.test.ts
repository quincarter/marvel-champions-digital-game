import { describe, expect, test } from "vitest";
import { CORE_STARTER_DECKS, cardId, deckFromStarterDeck, type Deck } from "@mc/content";
import { MemoryDeckStorage } from "./deck-storage.js";
import { RepairingDeckStorage } from "./precon-edit-repair.js";
import { addCard, repairedStoredDeck } from "../view/deck-builder-model.js";

const NOW = "2026-10-17T00:00:00.000Z";
const precon = deckFromStarterDeck(CORE_STARTER_DECKS[0]!, "poolv1");
const repair = (deck: Deck): Deck | null =>
  repairedStoredDeck(deck, deck.source.kind === "precon" ? precon : null, `deck-from-${deck.id as string}`, NOW);

describe("RepairingDeckStorage (issue #217)", () => {
  test("a precon edit saved under the precon's id becomes the player's own deck; an unedited one is removed", async () => {
    const inner = new MemoryDeckStorage();
    const edited = addCard(precon, cardId("01088"));
    await inner.put(edited);
    const storage = new RepairingDeckStorage(inner, repair);

    const listed = await storage.list();
    expect(listed).toHaveLength(1);
    expect(listed[0]!.id).toBe(`deck-from-${precon.id as string}`);
    expect(listed[0]!.source.kind).toBe("userBuilt");
    expect(listed[0]!.cards).toEqual(edited.cards);
    expect(await inner.get(precon.id)).toBeNull();

    await inner.put(precon);
    // The repair runs once per storage: a later list returns what is stored.
    expect(await storage.list()).toHaveLength(2);
    expect(await new RepairingDeckStorage(inner, repair).list()).toHaveLength(1);
  });
});
