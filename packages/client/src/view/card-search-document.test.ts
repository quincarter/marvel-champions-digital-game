import { describe, expect, test } from "vitest";
import { CORE_CARDS } from "@mc/content";
import { POOL_CARDS } from "../content/pool.js";
import { cardSearchDocumentOf, plainRulesTextOf } from "./card-search-document.js";
import { prepareDocuments, rankDocuments } from "./deck-search.js";

const playerCards = CORE_CARDS.filter((card) =>
  ["ally", "event", "upgrade", "support", "resource"].includes(card.type),
);
const ranked = (query: string): string[] =>
  rankDocuments(prepareDocuments(playerCards.map((card) => cardSearchDocumentOf(card, "Core Set"))), query).map(
    (r) => r.id,
  );
const nameOf = (id: string): string => CORE_CARDS.find((card) => (card.id as string) === id)!.name;

describe("cardSearchDocumentOf", () => {
  test("a subtitle tells apart allies that share a name (issue #596)", () => {
    const allies = POOL_CARDS.filter((card) => card.name === "Spider-Man" && card.type === "ally");
    const found = rankDocuments(prepareDocuments(allies.map((card) => cardSearchDocumentOf(card))), "otto");
    expect(found.map((r) => r.id)).toEqual(["31022"]);
  });

  test(`"spdr" finds SP//dr (issue #597)`, () => {
    const named = POOL_CARDS.filter((card) => card.name.includes("SP//dr"));
    expect(named.length).toBeGreaterThan(0);
    const found = rankDocuments(prepareDocuments(named.map((card) => cardSearchDocumentOf(card))), "spdr");
    expect(found).toHaveLength(named.length);
  });

  test("a name match ranks above a card that only mentions the word in its rules", () => {
    const found = ranked("for justice");
    expect(nameOf(found[0]!)).toBe("For Justice!");
  });

  test("a word only in rules text still finds the card", () => {
    const card = playerCards.find((c) => /\bready\b/i.test(plainRulesTextOf(c)) && !/ready/i.test(c.name))!;
    expect(ranked("ready")).toContain(card.id as string);
  });

  test("traits are searchable", () => {
    const shield = playerCards.find((c) => "traits" in c && (c.traits as readonly string[]).includes("S.H.I.E.L.D."))!;
    expect(ranked("shield")).toContain(shield.id as string);
  });

  test("rules text icons and underscores read as words", () => {
    const withIcon = playerCards.find((c) => /\[\w+\]/.test(JSON.stringify("text" in c ? c.text : "")));
    if (withIcon) expect(plainRulesTextOf(withIcon)).not.toMatch(/[[\]_]/);
  });
});
