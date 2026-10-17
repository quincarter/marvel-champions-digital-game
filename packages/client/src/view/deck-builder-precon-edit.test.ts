import { describe, expect, test } from "vitest";
import { CORE_CARDS, CORE_STARTER_DECKS, cardId, deckFromStarterDeck, type Deck } from "@mc/content";
import {
  addCard,
  browsablePool,
  editableDeckOf,
  hasUnsavedChanges,
  identityOptions,
  newDeck,
  preconsFor,
  repairedStoredDeck,
  searchTermsOf,
  setAspects,
  setName,
  startingDeckOf,
} from "./deck-builder-model.js";

const spiderMan = identityOptions(CORE_CARDS).find((c) => c.name === "Spider-Man")!;
const NOW = "2026-10-17T00:00:00.000Z";
const starter = CORE_STARTER_DECKS.find((s) => (s.identityCardId as string) === (spiderMan.id as string))!;
const precon = (): Deck => deckFromStarterDeck(starter, "poolv1");

describe("editing a precon (issue #217)", () => {
  test("the builder edits the player's own copy: a fresh id, userBuilt, named as a copy", () => {
    const copy = editableDeckOf(precon(), "deck-new", NOW);
    expect(copy.id).toBe("deck-new");
    expect(copy.source).toEqual({ kind: "userBuilt", createdAt: NOW });
    expect(copy.name).toBe(`${starter.name} (copy)`);
    expect(copy.cards).toEqual(precon().cards);
    expect(copy.aspects).toEqual(precon().aspects);
  });

  test("a saved deck is edited as it is", () => {
    const saved = newDeck(spiderMan, CORE_CARDS, "deck-1", "poolv1", NOW);
    expect(editableDeckOf(saved, "deck-other", NOW)).toBe(saved);
  });
});

describe("startingDeckOf: New deck's Start from step", () => {
  test("no precon: the identity's signature cards only, no aspect", () => {
    const deck = startingDeckOf(spiderMan, null, CORE_CARDS, "deck-1", "poolv1", NOW);
    expect(deck).toEqual(newDeck(spiderMan, CORE_CARDS, "deck-1", "poolv1", NOW));
  });

  test("a precon: its aspects and cards under the new id, as the player's own deck", () => {
    const deck = startingDeckOf(spiderMan, starter, CORE_CARDS, "deck-1", "poolv1", NOW);
    expect(deck.id).toBe("deck-1");
    expect(deck.source.kind).toBe("userBuilt");
    expect(deck.aspects).toEqual([...starter.aspects]);
    expect(deck.cards).toEqual(precon().cards);
    expect(deck.name).toBe(`${starter.name} (copy)`);
  });

  test("preconsFor lists every precon of the identity", () => {
    expect(preconsFor(spiderMan, CORE_STARTER_DECKS)).toEqual([starter]);
    expect(preconsFor(spiderMan, [])).toEqual([]);
  });
});

describe("hasUnsavedChanges", () => {
  const saved = newDeck(spiderMan, CORE_CARDS, "deck-1", "poolv1", NOW);
  test("nothing changed, or only the card order", () => {
    expect(hasUnsavedChanges(saved, saved)).toBe(false);
    expect(hasUnsavedChanges({ ...saved, cards: [...saved.cards].reverse() }, saved)).toBe(false);
  });
  test("a card, an aspect or the name changed", () => {
    expect(hasUnsavedChanges(addCard(saved, cardId("01088")), saved)).toBe(true);
    expect(hasUnsavedChanges(setAspects(saved, ["justice"]), saved)).toBe(true);
    expect(hasUnsavedChanges(setName(saved, "Mine"), saved)).toBe(true);
  });
  test("a deck never saved always has changes", () => {
    expect(hasUnsavedChanges(saved, null)).toBe(true);
  });
});

describe("repairedStoredDeck: precon edits saved before the fix", () => {
  test("an edited precon becomes the player's own deck, keeping its cards", () => {
    const stored = { ...addCard(precon(), cardId("01088")), updatedAt: "2026-10-16T00:00:00.000Z" };
    const repaired = repairedStoredDeck(stored, precon(), "deck-repaired", NOW)!;
    expect(repaired.id).toBe("deck-repaired");
    expect(repaired.source).toEqual({ kind: "userBuilt", createdAt: "2026-10-16T00:00:00.000Z" });
    expect(repaired.cards).toEqual(stored.cards);
    expect(repaired.name).toBe(`${starter.name} (copy)`);
  });

  test("a renamed one keeps the player's name", () => {
    const stored = setName(addCard(precon(), cardId("01088")), "Spidey tuned");
    expect(repairedStoredDeck(stored, precon(), "deck-repaired", NOW)!.name).toBe("Spidey tuned");
  });

  test("one identical to its precon is dropped", () => {
    expect(repairedStoredDeck(precon(), precon(), "deck-repaired", NOW)).toBeNull();
  });

  test("any other deck comes back unchanged", () => {
    const saved = newDeck(spiderMan, CORE_CARDS, "deck-1", "poolv1", NOW);
    expect(repairedStoredDeck(saved, null, "x", NOW)).toBe(saved);
  });
});

describe("pool search reads rules text and every word", () => {
  const pool = browsablePool(CORE_CARDS, spiderMan, ["justice"]);
  const textOf = (card: (typeof pool)[number]): string =>
    "text" in card && card.text ? (card.text as { current: string }).current.toLowerCase() : "";

  test("a word only in a card's rules text finds it", () => {
    const card = pool.find((c) => /\bready\b/.test(textOf(c)) && !c.name.toLowerCase().includes("ready"))!;
    expect(card).toBeDefined();
    const found = browsablePool(CORE_CARDS, spiderMan, ["justice"], { text: "ready" });
    expect(found.map((c) => c.id)).toContain(card.id);
  });

  test("several words must all match, and name matches come first", () => {
    const found = browsablePool(CORE_CARDS, spiderMan, ["justice"], { text: "for justice" });
    expect(found[0]?.name).toBe("For Justice!");
    const both = browsablePool(CORE_CARDS, spiderMan, ["justice"], { text: "zzzz justice" });
    expect(both).toEqual([]);
  });

  test("searchTermsOf splits on whitespace and lowercases", () => {
    expect(searchTermsOf("  Ready   ALLY ")).toEqual(["ready", "ally"]);
    expect(searchTermsOf(undefined)).toEqual([]);
  });
});
