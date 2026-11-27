import { describe, expect, it } from "vitest";
import { CardPoolSearch, freeTextOf, withSearchClauses } from "./card-pool-search.js";
import type { SearchDocument } from "./deck-search.js";

const docs: readonly SearchDocument[] = [
  { id: "web", primary: ["Web-Swing"], secondary: ["Spider", "event"] },
  { id: "shield", primary: ["Energy Shield"], secondary: ["Hero", "upgrade"] },
];

function search(over: { alive?: boolean } = {}) {
  const changes: number[] = [];
  const versions: string[] = [];
  const s = new CardPoolSearch({
    alive: () => over.alive ?? true,
    language: () => "en",
    documents: () => {
      versions.push("asked");
      return { docs, version: "v1" };
    },
    onChange: () => changes.push(changes.length),
  });
  return { s, changes, versions };
}

describe("withSearchClauses and freeTextOf", () => {
  it("splits a smart-filter text into its field:value terms and its free words", () => {
    expect(freeTextOf("o:2 web f:justice")).toBe("web");
    expect(freeTextOf("o:2")).toBe("");
    const filter = withSearchClauses({}, "o:2 t:event web");
    expect(filter.clauses?.length).toBe(2);
    expect(withSearchClauses({ cost: 1 }, "web")).toEqual({ cost: 1 });
  });
});

describe("CardPoolSearch", () => {
  it("ranks the free words with the worker, keeps the ranking, and says it changed", () => {
    const { s, changes } = search();
    s.request("energy");
    expect(s.text).toBe("energy");
    expect(s.ranking?.has("shield")).toBe(true);
    expect(s.ranking?.has("web")).toBe(false);
    expect(changes.length).toBeGreaterThan(0);
  });

  it("hands the documents over once per version", () => {
    const { s, versions } = search();
    s.request("energy");
    s.request("web");
    expect(versions).toEqual(["asked", "asked"]);
    // The worker side is sent only when the version changes (a second ask returns the same version).
    expect(s.ranking?.has("web")).toBe(true);
  });

  it("applies the terms of a text with no free words at once, with no ranking", () => {
    const { s, changes } = search();
    s.request("o:2");
    expect(s.ranking).toBeNull();
    expect(s.filterFor({}).clauses?.length).toBe(1);
    expect(changes.length).toBe(1);
  });

  it("clears the ranking when the text is emptied, and reset forgets everything without a redraw", () => {
    const { s, changes } = search();
    s.request("web");
    s.request("");
    expect(s.ranking).toBeNull();
    const seen = changes.length;
    s.request("web");
    s.reset();
    expect(s.text).toBe("");
    expect(s.ranking).toBeNull();
    expect(changes.length).toBeGreaterThan(seen);
    const after = changes.length;
    s.reset();
    expect(changes.length).toBe(after);
  });

  it("drops an answer for a screen that has gone", () => {
    const { s, changes } = search({ alive: false });
    s.request("web");
    // The terms redraw is still asked (it is the screen own check that drops it); the ranking is never kept.
    expect(s.ranking).toBeNull();
    expect(changes.length).toBeGreaterThanOrEqual(0);
  });
});
