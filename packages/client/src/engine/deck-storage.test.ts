/**
 * One contract, two storages — the same shape as `game-storage.test.ts`, so
 * `MemoryDeckStorage` (Vitest, and the in-app default) is proven to behave
 * exactly like the real `IdbDeckStorage` does.
 */
import "fake-indexeddb/auto";
import { IDBFactory } from "fake-indexeddb";
import { describe, expect, test } from "vitest";
import { cardId, deckFromStarterDeck, deckId, type Deck, type DeckCardEntry } from "@mc/content";
import { CORE_POOL_VERSION, CORE_STARTER_DECKS } from "@mc/content";
import { MemoryDeckStorage, type DeckStorage } from "./deck-storage.js";
import { IdbDeckStorage } from "./idb-deck-storage.js";

const spiderMan = deckFromStarterDeck(CORE_STARTER_DECKS[0]!, CORE_POOL_VERSION);

const userDeck = (overrides: Partial<Deck> = {}): Deck => ({
  ...spiderMan,
  id: deckId("user:1"),
  name: "My Spidey Deck",
  source: { kind: "userBuilt", createdAt: "2026-09-13T00:00:00.000Z" },
  ...overrides,
});

describe.each<[string, () => DeckStorage]>([
  ["memory", () => new MemoryDeckStorage()],
  ["IndexedDB", () => new IdbDeckStorage(new IDBFactory())],
])("%s deck storage", (_name, make) => {
  test("a saved deck round-trips exactly", async () => {
    const storage = make();
    const deck = userDeck();
    await storage.put(deck);
    expect(await storage.get(deck.id)).toEqual(deck);
  });

  test("an unknown deck reads as null", async () => {
    expect(await make().get(deckId("nope"))).toBeNull();
  });

  test("put again on the same id overwrites rather than duplicating", async () => {
    const storage = make();
    const deck = userDeck();
    await storage.put(deck);
    await storage.put({ ...deck, name: "Renamed" });
    expect(await storage.get(deck.id)).toMatchObject({ name: "Renamed" });
    expect(await storage.list()).toHaveLength(1);
  });

  test("list returns every saved deck", async () => {
    const storage = make();
    await storage.put(userDeck({ id: deckId("a") }));
    await storage.put(userDeck({ id: deckId("b") }));
    expect((await storage.list()).map((d) => d.id).sort()).toEqual(["a", "b"]);
  });

  test("remove deletes it", async () => {
    const storage = make();
    const deck = userDeck();
    await storage.put(deck);
    await storage.remove(deck.id);
    expect(await storage.get(deck.id)).toBeNull();
    expect(await storage.list()).toEqual([]);
  });

  test("what comes back is a copy: mutating it doesn't change the stored deck", async () => {
    const storage = make();
    const deck = userDeck();
    await storage.put(deck);
    const loaded = await storage.get(deck.id);
    (loaded!.cards as DeckCardEntry[]).push({ cardId: cardId("99999"), quantity: 1 });
    expect((await storage.get(deck.id))!.cards).toEqual(deck.cards);
  });

  test("an imported deck's source (site, id, url, importedAt) round-trips", async () => {
    const storage = make();
    const deck = userDeck({
      id: deckId("imported:1"),
      source: {
        kind: "imported",
        site: "marvelcdb",
        marvelcdbDeckId: "1",
        url: "https://marvelcdb.com/decklist/view/1/x",
        importedAt: "2026-09-13T00:00:00.000Z",
      },
    });
    await storage.put(deck);
    expect(await storage.get(deck.id)).toEqual(deck);
  });
});
