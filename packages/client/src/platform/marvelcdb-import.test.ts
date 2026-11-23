import { describe, expect, test } from "vitest";
import { CORE_CARDS, CORE_POOL_VERSION, CORE_STARTER_DECKS } from "@mc/content";
import type { ImportEnv } from "../view/deck-import-model.js";
import { importedDeckNote, importMarvelCdbDeck, marvelCdbFailureMessage } from "./marvelcdb-import.js";

const env: ImportEnv = {
  pool: CORE_CARDS,
  poolVersion: CORE_POOL_VERSION,
  now: () => "2026-11-23T00:00:00.000Z",
  newId: () => "new-id",
  existingNames: [],
};

const RESPONSE = JSON.stringify({
  id: 1,
  name: "Black Panther - Protection - Starter Deck",
  hero_code: "01040a",
  hero_name: "Black Panther",
  slots: Object.fromEntries(
    CORE_STARTER_DECKS.find((d) => d.name.startsWith("Black Panther"))!.cards.map((c) => [c.cardId, c.quantity]),
  ),
  meta: '{"aspect":"protection"}',
});

describe("importMarvelCdbDeck", () => {
  test("a link fetches that decklist and returns the deck, its source naming the MarvelCDB page", async () => {
    const asked: string[] = [];
    const result = await importMarvelCdbDeck("https://marvelcdb.com/decklist/view/1/black-panther", env, (kind, id) => {
      asked.push(`${kind}/${id}`);
      return Promise.resolve({ status: 200, body: RESPONSE });
    });
    expect(asked).toEqual(["decklist/1"]);
    if (!result.ok) throw new Error(result.message);
    expect(result.deck.name).toBe("Black Panther - Protection - Starter Deck");
    expect(result.deck.source).toMatchObject({ kind: "imported", marvelcdbDeckId: "1" });
  });

  test("something that is no link or id is refused before any fetch, in Decks' words", async () => {
    const result = await importMarvelCdbDeck("hello there", env, () => Promise.reject(new Error("no fetch")));
    expect(result).toEqual({ ok: false, message: "That doesn't look like a MarvelCDB deck link or id." });
  });

  test("a 404 says the import is not available here; a server's own error text wins; a thrown fetch reports its cause", async () => {
    const notFound = await importMarvelCdbDeck("1", env, () => Promise.resolve({ status: 404, body: "" }));
    expect(notFound.ok).toBe(false);
    if (!notFound.ok) expect(notFound.message).toContain("isn't available in this deployment");
    const own = await importMarvelCdbDeck("1", env, () =>
      Promise.resolve({ status: 502, body: JSON.stringify({ error: "could not reach MarvelCDB" }) }),
    );
    expect(own).toEqual({ ok: false, message: "could not reach MarvelCDB" });
    const thrown = await importMarvelCdbDeck("1", env, () => Promise.reject(new Error("offline")));
    expect(thrown).toEqual({ ok: false, message: "offline" });
  });

  test("an answer that is not a deck fails with the importer's problems", async () => {
    const result = await importMarvelCdbDeck("1", env, () => Promise.resolve({ status: 200, body: "{}" }));
    expect(result.ok).toBe(false);
  });
});

describe("messages", () => {
  test("a plain status without a body names the HTTP code", () => {
    expect(marvelCdbFailureMessage(500, "oops")).toBe("MarvelCDB import failed (HTTP 500).");
  });
  test("the imported note names at most three skipped lines", () => {
    expect(importedDeckNote("X", [])).toBe('Imported "X".');
    expect(importedDeckNote("X", ["a", "b", "c", "d", "e"])).toBe('Imported "X".\na\nb\nc\n…and 2 more lines.');
  });
});
