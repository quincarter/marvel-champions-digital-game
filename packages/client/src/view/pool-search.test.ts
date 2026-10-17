import { describe, expect, it } from "vitest";
import { filterBySearch, searchHaystack, searchWords } from "./pool-search.js";

const cards = [
  { name: "Swinging Web Kick", traits: ["Attack", "Spider"], type: "event", rulesText: "Deal 4 damage to an enemy." },
  { name: "Daredevil", traits: ["Avenger"], type: "ally", rulesText: "Thwart 1. Retaliate." },
];
const hay = (c: (typeof cards)[number]): string => searchHaystack(c);

describe("pool search", () => {
  it("splits words and ignores blanks", () => {
    expect(searchWords("  Web   KICK ")).toEqual(["web", "kick"]);
    expect(searchWords("   ")).toEqual([]);
  });

  it("returns everything for a blank search", () => {
    expect(filterBySearch(cards, "  ", hay)).toEqual(cards);
  });

  it("matches name, trait, type and rules text case-insensitively", () => {
    expect(filterBySearch(cards, "DAREDEVIL", hay)).toEqual([cards[1]]);
    expect(filterBySearch(cards, "spider", hay)).toEqual([cards[0]]);
    expect(filterBySearch(cards, "ally", hay)).toEqual([cards[1]]);
    expect(filterBySearch(cards, "retaliate", hay)).toEqual([cards[1]]);
  });

  it("requires every word, in any field", () => {
    expect(filterBySearch(cards, "spider damage", hay)).toEqual([cards[0]]);
    expect(filterBySearch(cards, "spider thwart", hay)).toEqual([]);
  });
});
