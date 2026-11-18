/**
 * Every search box forgives the same way (issue #800, the owner, 2026-11-17: "fuzzy search should be table stakes"):
 * accents and case never matter, a typo in a longer word and a letter or two left out of a short one still find it.
 * One check per search that filters where it is drawn; the worker searches share `view/deck-search.ts` already.
 */
import { describe, expect, test } from "vitest";
import { POOL_CARDS } from "../content/pool.js";
import { searchBook, type BookSection } from "./book-model.js";
import { filterCollectionPicker, type CollectionPickerRow } from "./campaign-collection-picker-model.js";
import { queryScoreOf } from "./deck-search.js";
import { rulesGlossaryPoolOf } from "./rules-reference.js";
import { matchesSearch } from "./roster-filter.js";

describe("queryScoreOf", () => {
  test("accents, case, a typo and letters left out all match; a wrong first letter does not", () => {
    expect(queryScoreOf("sabado", { primary: ["Sábado de gloria"] })).not.toBeNull();
    expect(queryScoreOf("RETALIATE", { primary: ["Retaliate X"] })).not.toBeNull();
    expect(queryScoreOf("retalaite", { primary: ["Retaliate X"] })).not.toBeNull();
    expect(queryScoreOf("crd siz", { primary: ["Card size"] })).not.toBeNull();
    expect(queryScoreOf("zard", { primary: ["Card size"] })).toBeNull();
    expect(queryScoreOf("  ", { primary: ["Card size"] })).toBe(0);
  });
});

describe("each search that filters where it is drawn", () => {
  test("the roster filter: Spider-Man by shorthand, Señor by plain letters", () => {
    expect(matchesSearch(["Spider-Man", "Peter Parker"], "spdr")).toBe(true);
    expect(matchesSearch(["Señor Bueno"], "senor")).toBe(true);
    expect(matchesSearch(["Spider-Man"], "hulk")).toBe(false);
  });

  test("the Rules glossary: a typo'd term still finds it", () => {
    const found = rulesGlossaryPoolOf(POOL_CARDS, "retalaite").map((entry) => entry.displayName);
    expect(found[0]).toMatch(/^Retaliate/);
  });

  test("the rulebook reader: a title by shorthand, the text without its accents", () => {
    const sections: BookSection[] = [
      { title: "Setup", blocks: [{ kind: "paragraph", text: "Shuffle the encounter deck." }] },
      { title: "Campaign log", blocks: [{ kind: "paragraph", text: "Write the héroes who fell." }] },
    ];
    expect(searchBook(sections, "campgn")).toEqual([1]);
    expect(searchBook(sections, "heroes")).toEqual([1]);
  });

  test("the campaign collection picker's own filter, while its ranking is on the way", () => {
    const rows = [
      { cardId: "a", name: "Energy", aspect: "basic", typeLabel: "Resource" },
      { cardId: "b", name: "Mockingbird", aspect: "protection", typeLabel: "Ally" },
    ] as unknown as CollectionPickerRow[];
    expect(filterCollectionPicker(rows, { text: "mckngbird" }).map((row) => row.name)).toEqual(["Mockingbird"]);
  });
});
