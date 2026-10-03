import { describe, expect, test } from "vitest";
import {
  glossaryCardHeight,
  glossaryCellRect,
  glossaryGridColumns,
  glossaryRowHeight,
  glossaryRowHeights,
} from "./rules-glossary-grid.js";

const CITE = "RRG 1.8 p. 1";

describe("glossaryGridColumns", () => {
  test("one column on a phone-width panel", () => {
    expect(glossaryGridColumns(358).columns).toBe(1);
  });

  test("more columns on a wider panel, never past the cap", () => {
    expect(glossaryGridColumns(800).columns).toBeGreaterThanOrEqual(2);
    expect(glossaryGridColumns(4000).columns).toBeLessThanOrEqual(3);
  });

  test("cells never divide narrower than the minimum, even at one column on a very narrow panel", () => {
    expect(glossaryGridColumns(50).cellWidth).toBeGreaterThan(0);
    expect(glossaryGridColumns(50).columns).toBe(1);
  });
});

describe("glossaryCellRect", () => {
  test("lays columns out left to right with the grid gap between them", () => {
    const geometry = glossaryGridColumns(800);
    const row = { x: 10, y: 20, width: 800, height: 200 };
    const first = glossaryCellRect(geometry, row, 0);
    const second = glossaryCellRect(geometry, row, 1);
    expect(first.x).toBe(10);
    expect(second.x).toBeCloseTo(first.x + first.width + 12, 5);
    expect(first.height).toBe(row.height);
  });
});

describe("glossaryCardHeight / glossaryRowHeight", () => {
  test("a longer definition needs more height than a shorter one at the same width", () => {
    const short = glossaryCardHeight({ definition: "Short.", citeLabel: CITE, cardRefCount: 0 }, 300);
    const long = glossaryCardHeight(
      {
        definition:
          "A much longer definition that wraps across several lines at this column width, needing real room to read without clipping.",
        citeLabel: CITE,
        cardRefCount: 0,
      },
      300,
    );
    expect(long).toBeGreaterThan(short);
  });

  test("an entry with card thumbnails needs more height than the same text with none", () => {
    const withoutCards = glossaryCardHeight(
      { definition: "Some definition text.", citeLabel: CITE, cardRefCount: 0 },
      300,
    );
    const withCards = glossaryCardHeight(
      { definition: "Some definition text.", citeLabel: CITE, cardRefCount: 3 },
      300,
    );
    expect(withCards).toBeGreaterThan(withoutCards);
  });

  test("a narrower cell needs at least as much height for the same text (more wrapped lines, never fewer)", () => {
    const wide = glossaryCardHeight(
      {
        definition: "A definition long enough to wrap at least once at a narrow width.",
        citeLabel: CITE,
        cardRefCount: 0,
      },
      380,
    );
    const narrow = glossaryCardHeight(
      {
        definition: "A definition long enough to wrap at least once at a narrow width.",
        citeLabel: CITE,
        cardRefCount: 0,
      },
      260,
    );
    expect(narrow).toBeGreaterThanOrEqual(wide);
  });

  test("a cite label long enough to wrap to two lines needs more height than a short one-line cite", () => {
    const shortCite = glossaryCardHeight(
      { definition: "Some definition text.", citeLabel: CITE, cardRefCount: 0 },
      260,
    );
    const longCite = glossaryCardHeight(
      {
        definition: "Some definition text.",
        citeLabel: "Fear No Evil rulebook, p. 3 · February 28, 2026 - Ruling 4",
        cardRefCount: 0,
      },
      260,
    );
    expect(longCite).toBeGreaterThan(shortCite);
  });

  test("an entry with a player note needs more height than the same entry without one", () => {
    const withoutNote = glossaryCardHeight(
      { definition: "Some definition text.", citeLabel: CITE, cardRefCount: 0 },
      300,
    );
    const withNote = glossaryCardHeight(
      {
        definition: "Some definition text.",
        citeLabel: CITE,
        playerNote: "Rulings differ on whether this happens before or after the minion's When Revealed.",
        cardRefCount: 0,
      },
      300,
    );
    expect(withNote).toBeGreaterThan(withoutNote);
  });

  test("glossaryRowHeight is the tallest entry among several, never less than the minimum", () => {
    const entries = [
      { definition: "Short.", citeLabel: CITE, cardRefCount: 0 },
      {
        definition:
          "A longer one that wraps more than once and needs real room to read in full without clipping into the row below.",
        citeLabel: CITE,
        cardRefCount: 2,
      },
    ];
    const height = glossaryRowHeight(entries, 300);
    expect(height).toBe(Math.max(...entries.map((e) => glossaryCardHeight(e, 300))));
    expect(glossaryRowHeight([], 300, 150)).toBe(150);
  });
});

describe("glossaryRowHeights", () => {
  test("one height per row of `columns` entries, not one height for the whole tab", () => {
    const short = { definition: "Short.", citeLabel: CITE, cardRefCount: 0 };
    const tall = {
      definition:
        "A much longer definition that wraps across several lines at this column width, needing real room to read without clipping.",
      citeLabel: CITE,
      cardRefCount: 3,
    };
    // Two rows of two columns: the first row (both short) stays compact, the second (one tall
    // entry) grows to fit it — the whole point of a *per-row* height over one uniform height.
    const heights = glossaryRowHeights([short, short, short, tall], 2, 300);
    expect(heights).toHaveLength(2);
    expect(heights[0]).toBeLessThan(heights[1]!);
    expect(heights[0]).toBe(glossaryRowHeight([short, short], 300));
    expect(heights[1]).toBe(glossaryRowHeight([short, tall], 300));
  });

  test("a short trailing row (fewer than `columns` entries) still gets its own height", () => {
    const entry = { definition: "Some definition text.", citeLabel: CITE, cardRefCount: 0 };
    const heights = glossaryRowHeights([entry, entry, entry], 2, 300);
    expect(heights).toHaveLength(2);
  });

  test("no entries makes no rows", () => {
    expect(glossaryRowHeights([], 2, 300)).toEqual([]);
  });

  test("never less than the minimum, per row", () => {
    const entry = { definition: "Short.", citeLabel: CITE, cardRefCount: 0 };
    for (const height of glossaryRowHeights([entry, entry], 2, 300, 150)) expect(height).toBeGreaterThanOrEqual(150);
  });
});

describe("glossaryCardHeight with an origin note", () => {
  it("reserves room for the origin line", () => {
    const base = { definition: "x", citeLabel: "RRG 1.8 p. 1", cardRefCount: 0 };
    const withNote = { ...base, originNote: "Added with Mutant Genesis · applies to Core cards too" };
    expect(glossaryCardHeight(withNote, 300)).toBeGreaterThan(glossaryCardHeight(base, 300));
  });
});
