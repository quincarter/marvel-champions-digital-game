import { describe, expect, test } from "vitest";
import { POOL_CARDS, POOL_HERO_SHELF_PACKS, POOL_PACKS } from "../content/pool.js";
import type { PackInfo } from "./deck-builder-model.js";
import { matchesClauses, parsePoolQuery } from "./pool-query.js";
import { SEARCH_HELP_ROWS, searchHelpRows } from "./search-help.js";

const PACKS: readonly PackInfo[] = POOL_PACKS.map((pack) => {
  const shelf = POOL_HERO_SHELF_PACKS.find((p) => p.code === (pack.code as string));
  return {
    code: pack.code as string,
    name: pack.name,
    cycleId: shelf?.cycleId ?? (pack.cycleId as string),
    cycleName: shelf?.cycleName ?? (pack.cycleId as string),
  };
});

const queries = SEARCH_HELP_ROWS.flatMap((row) => (row.kind === "query" ? [row.query] : []));

describe("the search cheat sheet (issue #531)", () => {
  test.each(queries)("%s parses, and its terms find a card", (query) => {
    const { clauses } = parsePoolQuery(query);
    expect(clauses.length).toBeGreaterThan(0);
    expect(POOL_CARDS.some((card) => matchesClauses(card, clauses, PACKS))).toBe(true);
  });

  test("every meaning fits the phone row's two lines", () => {
    for (const row of SEARCH_HELP_ROWS) if (row.kind === "query") expect(row.meaning.length).toBeLessThanOrEqual(60);
  });

  test("only the two word examples leave free words", () => {
    const withWords = queries.filter((query) => parsePoolQuery(query).text !== "");
    expect(withWords).toEqual(["spider t:ally", "web t:event o<2"]);
  });

  test("every field the search reads has a row under Every term", () => {
    const at = SEARCH_HELP_ROWS.findIndex((row) => row.kind === "heading" && row.text === "Every term");
    const end = SEARCH_HELP_ROWS.findIndex((row) => row.kind === "heading" && row.text === "Try these");
    const fields = new Set(
      SEARCH_HELP_ROWS.slice(at, end).flatMap((row) =>
        row.kind === "query" ? parsePoolQuery(row.query).clauses.map((c) => c.field) : [],
      ),
    );
    expect([...fields].sort()).toEqual(
      [
        "aspect",
        "atk",
        "cost",
        "cycle",
        "energy",
        "flavor",
        "hp",
        "keyword",
        "mental",
        "pack",
        "physical",
        "text",
        "thw",
        "trait",
        "type",
        "unique",
        "wild",
      ].sort(),
    );
  });
});

describe("the search cheat sheet in Spanish", () => {
  const es = searchHelpRows("es");

  test("explains the same executable queries in Spanish, never translating the syntax", () => {
    expect(es.map((row) => (row.kind === "query" ? row.query : null))).toEqual(
      SEARCH_HELP_ROWS.map((row) => (row.kind === "query" ? row.query : null)),
    );
    const meanings = es.flatMap((row, i) => {
      const english = SEARCH_HELP_ROWS[i]!;
      return row.kind === "query" && english.kind === "query" ? [[row.meaning, english.meaning]] : [];
    });
    expect(meanings.every(([spanish, english]) => spanish !== "" && spanish !== english)).toBe(true);
    // Two lines fit on a phone row, a little more than English with the longer words.
    expect(es.every((row) => row.kind !== "query" || row.meaning.length <= 72)).toBe(true);
    expect(es[0]).toEqual({ kind: "heading", text: "Cómo funciona" });
  });

  test("a sample query from the Spanish sheet still parses and finds a card", () => {
    const sample = es.find((row) => row.kind === "query" && row.query === "f:justice");
    expect(sample).toMatchObject({ meaning: expect.stringContaining("Aspecto") });
    const { clauses } = parsePoolQuery("f:justice");
    expect(POOL_CARDS.some((card) => matchesClauses(card, clauses, PACKS))).toBe(true);
  });
});
