import { describe, expect, it } from "vitest";
import { CORE_CARDS, CORE_STARTER_DECKS, deckFromStarterDeck } from "@mc/content";
import type { DeckOption } from "./deck-list-model.js";
import { averageCostText, deckDetailsOf } from "./room-deck-details-model.js";
import { pickerRows } from "./room-deck-picker-model.js";

const starter = CORE_STARTER_DECKS[0]!;

const optionOf = (over: Partial<DeckOption> = {}, kind: "precon" | "userBuilt" = "precon"): DeckOption => {
  const deck = deckFromStarterDeck(starter, "poolv1");
  return {
    deck: kind === "precon" ? deck : { ...deck, source: { kind: "userBuilt" } },
    identityName: "Hero",
    legal: true,
    problems: [],
    unscripted: [],
    poolChanged: false,
    seatable: true,
    blockedReason: null,
    warning: null,
    ...over,
  } as unknown as DeckOption;
};

describe("deck details", () => {
  it("carries the deck's stats from the shared deck stats model", () => {
    const row = pickerRows([optionOf()], "")[0]!;
    const details = deckDetailsOf(row, CORE_CARDS);
    expect(details.title).toBe(row.name);
    expect(details.cardId).toBe(row.cardId);
    expect(details.countText).toMatch(/^\d+ cards/);
    expect(details.curve).toHaveLength(5);
    expect(details.curve.reduce((sum, bar) => sum + bar.count, 0)).toBeGreaterThan(0);
    expect(details.tiles.length).toBeGreaterThan(0);
    expect(details.groups.length).toBeGreaterThan(0);
    expect(details.groups[0]!.entries[0]!.cardId).toBeTruthy();
    expect(details.averageCostText).toMatch(/^Average cost \d\.\d$/);
    expect(details.missing).toBe(0);
  });
  it("offers a copy of a precon and an edit of the player's own deck", () => {
    const precon = deckDetailsOf(pickerRows([optionOf()], "")[0]!, CORE_CARDS);
    expect(precon.edit).toEqual({ label: "Edit a copy", copy: true });
    const own = deckDetailsOf(pickerRows([optionOf({}, "userBuilt")], "")[0]!, CORE_CARDS);
    expect(own.edit).toEqual({ label: "Edit deck", copy: false });
    const offer = optionOf({}, "userBuilt");
    const community = { ...offer, deck: { ...offer.deck, id: "community:77" } } as unknown as DeckOption;
    expect(deckDetailsOf(pickerRows([community], "")[0]!, CORE_CARDS).edit).toBeNull();
  });
  it("keeps the engine's verdict on the deck, and counts cards this build does not know", () => {
    const blocked = optionOf({ seatable: false, legal: false, blockedReason: "Needs 40 cards." });
    const details = deckDetailsOf(pickerRows([blocked], "")[0]!, []);
    expect(details).toMatchObject({ seatable: false, blockedReason: "Needs 40 cards.", current: false });
    expect(details.missing).toBeGreaterThan(0);
    expect(details.groups).toEqual([]);
  });
});

describe("average cost in Spanish", () => {
  it("writes the decimal with a comma", () => {
    expect(averageCostText(1.84, "es")).toBe("Coste medio 1,8");
    expect(averageCostText(1.84, "en")).toBe("Average cost 1.8");
  });
});
