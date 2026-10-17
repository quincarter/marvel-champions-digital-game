import { describe, expect, test } from "vitest";
import {
  DeckSearchHost,
  editDistance,
  prepareDocuments,
  rankDocuments,
  rankShelvesByScore,
  type SearchDocument,
} from "./deck-search.js";

const docs: readonly SearchDocument[] = [
  {
    id: "cm-lead",
    primary: ["Captain Marvel", "Carol Danvers"],
    secondary: ["leadership", "precon", "Core Set"],
  },
  {
    id: "cm-aggr",
    primary: ["Captain Marvel", "Carol Danvers"],
    secondary: ["aggression", "precon", "Core Set"],
  },
  {
    id: "rhino-fan",
    primary: ["Smash Brothers", "She-Hulk", "Jennifer Walters"],
    secondary: ["protection", "tested", "marvelcdb", "by Brian-V"],
    notes: ["A deck that makes Captain Marvel jealous. Plays well solo."],
  },
  { id: "spidey", primary: ["Spider-Man", "Peter Parker"], secondary: ["justice", "imported"] },
];
const ranked = (query: string): string[] => rankDocuments(prepareDocuments(docs), query).map((r) => r.id);

describe("rankDocuments", () => {
  test("an empty query keeps every document in order", () => {
    expect(ranked("")).toEqual(["cm-lead", "cm-aggr", "rhino-fan", "spidey"]);
  });

  test("a name match outranks a notes mention", () => {
    expect(ranked("captain marvel")).toEqual(["cm-lead", "cm-aggr", "rhino-fan"]);
  });

  test("prefix beats word beats substring", () => {
    const set = prepareDocuments([
      { id: "sub", primary: ["Xspider"] },
      { id: "word", primary: ["The Spider Deck"] },
      { id: "prefix", primary: ["Spider-Man"] },
    ]);
    expect(rankDocuments(set, "spider").map((r) => r.id)).toEqual(["prefix", "word", "sub"]);
  });

  test("matches the author, source, pack, aspect and alter ego", () => {
    expect(ranked("brian")).toEqual(["rhino-fan"]);
    expect(ranked("tested")).toEqual(["rhino-fan"]);
    expect(ranked("core set")).toEqual(["cm-lead", "cm-aggr"]);
    expect(ranked("justice")).toEqual(["spidey"]);
    expect(ranked("peter")).toEqual(["spidey"]);
  });

  test("every word must match; accents and case are ignored", () => {
    expect(ranked("marvel aggression")).toEqual(["cm-aggr"]);
    expect(ranked("CAROL dänvers")).toEqual(["cm-lead", "cm-aggr"]);
    expect(ranked("marvel spider")).toEqual([]);
  });

  test("small typos and letters in order still match, below real matches", () => {
    expect(ranked("captian")).toContain("cm-lead");
    expect(ranked("spdrmn")).toEqual(["spidey"]);
    const set = prepareDocuments([
      { id: "typo", primary: ["Captian Underpants"] },
      { id: "real", primary: ["Captain America"] },
    ]);
    expect(rankDocuments(set, "captain").map((r) => r.id)).toEqual(["real", "typo"]);
  });

  test("notes never match fuzzily", () => {
    expect(ranked("jelous")).toEqual([]);
    expect(ranked("jealous")).toEqual(["rhino-fan"]);
  });

  test("ties keep the order given", () => {
    expect(ranked("precon")).toEqual(["cm-lead", "cm-aggr"]);
  });
});

describe("short queries stay strict", () => {
  const panther: readonly SearchDocument[] = [
    { id: "bp", primary: ["Black Panther (T'Challa)", "T'Challa"], secondary: ["Protection", "Precon", "Core Set"] },
    { id: "cm", primary: ["Captain Marvel", "Carol Danvers"], secondary: ["Leadership", "Precon", "Core Set"] },
  ];
  const find = (query: string): string[] => rankDocuments(prepareDocuments(panther), query).map((r) => r.id);
  test("a four-letter word takes no typo and no scattered letters", () => {
    expect(find("capt")).toEqual(["cm"]);
  });
  test("a longer word still forgives one typo that keeps its first letter", () => {
    expect(find("captian")).toEqual(["cm"]);
    expect(find("kaptain")).toEqual([]);
  });
});

describe("editDistance", () => {
  test("counts edits and swaps, and gives up past the limit", () => {
    expect(editDistance("marvel", "marvel", 2)).toBe(0);
    expect(editDistance("marvel", "marvle", 2)).toBe(1);
    expect(editDistance("marvel", "mervil", 2)).toBe(2);
    expect(editDistance("abc", "xyzxyz", 1)).toBeGreaterThan(1);
  });
});

describe("DeckSearchHost", () => {
  test("prepares documents once and answers queries", () => {
    const host = new DeckSearchHost();
    host.setDocuments(docs);
    expect(host.search("spider").map((r) => r.id)).toEqual(["spidey"]);
  });
});

describe("rankShelvesByScore", () => {
  test("orders items and shelves by score, stably", () => {
    const score = new Map([
      ["a", 1],
      ["b", 9],
      ["c", 5],
      ["d", 5],
    ]);
    const shelves = [
      { id: "s1", items: ["a", "c"] },
      { id: "s2", items: ["d", "b"] },
    ];
    const out = rankShelvesByScore(shelves, (id) => score.get(id) ?? 0);
    expect(out.map((s) => [s.id, ...s.items])).toEqual([
      ["s2", "b", "d"],
      ["s1", "c", "a"],
    ]);
  });
});
