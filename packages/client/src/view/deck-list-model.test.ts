import { describe, expect, test } from "vitest";
import { CORE_CARDS, CORE_POOL_VERSION, CORE_STARTER_DECKS, deckFromStarterDeck, deckId, type Deck } from "@mc/content";
import { CORE_DEPS } from "@mc/cards";
import { deckOptionOf, deckOptionsOf, preconDecks } from "./deck-list-model.js";

describe("preconDecks", () => {
  test("every Core precon is present, one per starter deck", () => {
    expect(preconDecks().map((d) => d.source)).toEqual(
      CORE_STARTER_DECKS.map((s) => ({ kind: "precon", packCode: s.packCode, starterDeckId: s.id })),
    );
  });
});

describe("deckOptionOf", () => {
  test("a real Core precon is legal, playable, and seatable", () => {
    const deck = deckFromStarterDeck(CORE_STARTER_DECKS[0]!, CORE_POOL_VERSION);
    const option = deckOptionOf(deck, CORE_CARDS, CORE_POOL_VERSION, CORE_DEPS);
    expect(option.legal).toBe(true);
    expect(option.unscripted).toEqual([]);
    expect(option.seatable).toBe(true);
    expect(option.blockedReason).toBeNull();
    expect(option.poolChanged).toBe(false);
    expect(option.identityName).toBe("Spider-Man");
  });

  test("an illegal deck reports why, from the engine's own message, and is never seatable", () => {
    const starter = CORE_STARTER_DECKS[0]!;
    const deck: Deck = { ...deckFromStarterDeck(starter, CORE_POOL_VERSION), cards: [] };
    const option = deckOptionOf(deck, CORE_CARDS, CORE_POOL_VERSION, CORE_DEPS);
    expect(option.legal).toBe(false);
    expect(option.seatable).toBe(false);
    expect(option.problems.length).toBeGreaterThan(0);
    expect(option.blockedReason).toBe(option.problems[0]!.message);
    // Never asks the engine for playability of a deck that's already illegal.
    expect(option.unscripted).toEqual([]);
  });

  test("a deck built against an old pool version is flagged, even when it's still legal", () => {
    const deck = deckFromStarterDeck(CORE_STARTER_DECKS[0]!, "v1-00000000");
    const option = deckOptionOf(deck, CORE_CARDS, CORE_POOL_VERSION, CORE_DEPS);
    expect(option.legal).toBe(true);
    expect(option.poolChanged).toBe(true);
  });

  test("an unplayable-but-legal deck names which cards have no script yet", () => {
    const starter = CORE_STARTER_DECKS[0]!;
    const deck = deckFromStarterDeck(starter, CORE_POOL_VERSION);
    const bareDeps = { abilities: {} };
    const option = deckOptionOf(deck, CORE_CARDS, CORE_POOL_VERSION, bareDeps);
    expect(option.legal).toBe(true);
    expect(option.unscripted.length).toBeGreaterThan(0);
    expect(option.seatable).toBe(false);
    expect(option.blockedReason).toContain("no card script in this build");
  });
});

describe("deckOptionsOf", () => {
  test("precons come first, then saved decks, each carrying its own status", () => {
    const saved: Deck = { ...deckFromStarterDeck(CORE_STARTER_DECKS[1]!, CORE_POOL_VERSION), id: deckId("saved:1"), source: { kind: "userBuilt", createdAt: "2026-09-13T00:00:00.000Z" } };
    const options = deckOptionsOf([saved], CORE_CARDS, CORE_POOL_VERSION, CORE_DEPS);
    expect(options).toHaveLength(CORE_STARTER_DECKS.length + 1);
    expect(options.at(-1)!.deck.id).toBe(saved.id);
    expect(options.every((o) => o.seatable)).toBe(true);
  });
});
