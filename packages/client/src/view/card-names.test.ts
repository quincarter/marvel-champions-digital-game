import { afterEach, describe, expect, test } from "vitest";
import { cardNamesReady, loadCardNames, localizedNameOf, resetCardNamesForTest } from "./card-names.js";
import { cardSearchDocumentOf } from "./card-search-document.js";
import { DeckSearchHost } from "./deck-search.js";
import type { AnyCard } from "@mc/content";
import { CARDS_BY_ID } from "../content/pool.js";
import { CARD_NAMES_ES } from "../content/card-names-es.js";

afterEach(resetCardNamesForTest);

const card = (id: string, name: string): AnyCard => ({ id, name, type: "support", traits: [] }) as unknown as AnyCard;
const RAFT = card("51018", "The Raft");

describe("Spanish card names in the search (issue #806)", () => {
  test("English needs no table; Spanish loads on demand", async () => {
    expect(cardNamesReady("en")).toBe(true);
    expect(cardNamesReady("es")).toBe(false);
    expect(localizedNameOf("51018", "es")).toBeNull();
    await loadCardNames("es");
    expect(cardNamesReady("es")).toBe(true);
    expect(localizedNameOf("51018", "es")).toBe("La Balsa");
    expect(localizedNameOf("51018", "en")).toBeNull();
  });

  test("a failed import is not cached: the next request retries and loads the names", async () => {
    const failing = () => Promise.reject(new Error("offline"));
    expect(await loadCardNames("es", failing)).toBe(false);
    expect(cardNamesReady("es")).toBe(false);
    expect(localizedNameOf("51018", "es")).toBeNull();
    expect(await loadCardNames("es", () => Promise.resolve({ "51018": "La Balsa" }))).toBe(true);
    expect(cardNamesReady("es")).toBe(true);
    expect(localizedNameOf("51018", "es")).toBe("La Balsa");
  });

  test('searching "la balsa" (or "balsa", accent-free) finds The Raft, and "raft" still does', async () => {
    await loadCardNames("es");
    const host = new DeckSearchHost();
    host.setDocuments([
      cardSearchDocumentOf(RAFT, "Black Panther", localizedNameOf("51018", "es")),
      cardSearchDocumentOf(card("1", "Energy")),
    ]);
    for (const query of ["La Balsa", "balsa", "raft"]) {
      expect(host.search(query).map((r) => r.id)).toContain("51018");
    }
  });

  test("a document with no local name matches only its English name", () => {
    const host = new DeckSearchHost();
    host.setDocuments([cardSearchDocumentOf(RAFT, undefined, null)]);
    expect(host.search("balsa")).toEqual([]);
  });

  test("every key of the generated Spanish table is a card in the pool (scripts/card-names-es.mjs)", () => {
    const stray = Object.keys(CARD_NAMES_ES).filter((id) => !CARDS_BY_ID.has(id));
    expect(stray).toEqual([]);
  });
});
