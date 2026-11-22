/**
 * Take your seats' search words (#390 review on #963): a deck's document is the same in every language, so the search
 * worker's cache (pool version + deck ids) stays right across a language switch, and Spanish words find the deck.
 */
import { afterEach, describe, expect, test } from "vitest";
import { useEnglish, useSpanish } from "../i18n/test-language.js";
import { prepareDocuments, rankDocuments, type SearchDocument } from "./deck-search.js";
import { seatSearchWordsOf } from "./seat-search.js";

afterEach(() => useEnglish());

const docOf = (id: string, words: readonly string[]): SearchDocument => ({ id, primary: [id], secondary: words });

describe("seatSearchWordsOf", () => {
  test("the same words in English and in Spanish, for the same deck ids", () => {
    const english = seatSearchWordsOf(["pool", "leadership"], "userBuilt", true);
    useSpanish();
    expect(seatSearchWordsOf(["pool", "leadership"], "userBuilt", true)).toEqual(english);
  });

  test("an English-built index finds Spanish aspect and source words after switching to Spanish", () => {
    const docs = prepareDocuments([
      docOf("gwenpool", seatSearchWordsOf(["pool"], "precon", false)),
      docOf("captain-america", seatSearchWordsOf(["leadership"], "userBuilt", false)),
      docOf("black-widow", seatSearchWordsOf(["justice"], "imported", true)),
    ]);
    useSpanish();
    const ids = (query: string) => rankDocuments(docs, query).map((r) => r.id);
    expect(ids("Masacrismo")).toEqual(["gwenpool"]);
    expect(ids("Liderazgo")).toEqual(["captain-america"]);
    expect(ids("propio")).toEqual(["captain-america"]);
    expect(ids("probado")).toEqual(["black-widow"]);
    expect(ids("preconstruido")).toEqual(["gwenpool"]);
    // English words still work.
    expect(ids("'Pool")).toEqual(["gwenpool"]);
    expect(ids("built")).toEqual(["captain-america"]);
  });
});
