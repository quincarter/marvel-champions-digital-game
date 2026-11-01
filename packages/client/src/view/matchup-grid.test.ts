import { describe, expect, test } from "vitest";
import {
  bodyOf,
  cellAt,
  cellLookOf,
  cellRect,
  clampCursor,
  clampPan,
  cursorInView,
  flipGrid,
  hardestWin,
  legendLayoutOf,
  legendOf,
  matchupsOf,
  panToShow,
  readoutOf,
  shelfRowsOf,
  shelvesOf,
  stepCursor,
  tileRowsOf,
  tilesOf,
  visibleRange,
  winTierOf,
  type GridShape,
  type MatchupAxes,
  type MatchupGame,
  type MatchupNames,
} from "./matchup-grid.js";

const AXES: MatchupAxes = {
  scenarios: [
    { id: "rhino", name: "Rhino" },
    { id: "klaw", name: "Klaw" },
  ],
  heroes: [
    { id: "spider", name: "Spider-Man" },
    { id: "cap", name: "Captain Marvel" },
  ],
  modulars: [{ id: "bomb", name: "Bomb Scare" }],
};
const NAMES: MatchupNames = { scenario: (id) => `S ${id}`, hero: (id) => `H ${id}`, modular: (id) => `M ${id}` };
const game = (over: Partial<MatchupGame>): MatchupGame => ({
  scenarioId: "rhino",
  heroIds: ["spider"],
  modularIds: ["bomb"],
  won: true,
  tier: "standard",
  ...over,
});

describe("winTierOf", () => {
  test("the plain difficulties", () => {
    expect(winTierOf({ difficulty: "standard" })).toBe("standard");
    expect(winTierOf({ difficulty: "expert" })).toBe("expert");
    expect(winTierOf({ difficulty: "extreme" })).toBe("extreme");
    expect(winTierOf({ difficulty: "standard", modes: { expert: true } })).toBe("expert");
  });

  test("a Heroic level outranks its base difficulty", () => {
    expect(winTierOf({ difficulty: "standard", modes: { heroic: 1 } })).toBe("heroic1");
    expect(winTierOf({ difficulty: "expert", modes: { heroic: 3 } })).toBe("heroic3");
  });

  test("a Skirmish is never an Expert or Heroic win", () => {
    const modes = { heroic: 2, skirmish: { villainVersion: "1" } };
    expect(winTierOf({ difficulty: "expert", modes })).toBe("skirmish");
  });
});

describe("matchupsOf", () => {
  test("keeps every pool entry on the axes, played or not, in pool order", () => {
    const { heroes } = matchupsOf([game({ scenarioId: "klaw", heroIds: ["cap"] })], AXES, NAMES);
    expect(heroes.rows.map((r) => r.id)).toEqual(["rhino", "klaw"]);
    expect(heroes.columns.map((c) => c.id)).toEqual(["spider", "cap"]);
    expect(heroes.cells).toEqual([{ row: 1, column: 1, wins: { standard: 1 }, losses: 0 }]);
  });

  test("adds what a game holds that the pool does not, named by the names", () => {
    const { heroes, modulars } = matchupsOf(
      [game({ scenarioId: "gone", heroIds: ["old"], modularIds: ["x"] })],
      AXES,
      NAMES,
    );
    expect(heroes.rows.at(-1)).toEqual({ id: "gone", name: "S gone" });
    expect(heroes.columns.at(-1)).toEqual({ id: "old", name: "H old" });
    expect(modulars.columns.at(-1)).toEqual({ id: "x", name: "M x" });
    expect(heroes.cells).toHaveLength(1);
  });

  test("a game with two heroes lands in both their cells, and each hero's set of modulars once", () => {
    const { heroes, modulars } = matchupsOf(
      [game({ heroIds: ["spider", "cap"], modularIds: ["bomb", "bomb"] })],
      AXES,
      NAMES,
    );
    expect(heroes.cells.map((c) => c.column)).toEqual([0, 1]);
    expect(modulars.cells).toEqual([{ row: 0, column: 0, wins: { standard: 1 }, losses: 0 }]);
  });

  test("counts wins by tier and losses in one cell", () => {
    const { heroes } = matchupsOf(
      [game({}), game({ tier: "expert" }), game({ tier: "expert" }), game({ won: false })],
      AXES,
      NAMES,
    );
    expect(heroes.cells).toEqual([{ row: 0, column: 0, wins: { standard: 1, expert: 2 }, losses: 1 }]);
  });
});

test("flipGrid swaps the axes and each cell with them", () => {
  const { heroes } = matchupsOf([game({ scenarioId: "klaw" })], AXES, NAMES);
  const flipped = flipGrid(heroes);
  expect(flipped.rows).toBe(heroes.columns);
  expect(flipped.columns).toBe(heroes.rows);
  expect(flipped.cells[0]).toMatchObject({ row: 0, column: 1 });
});

describe("how a cell looks", () => {
  const cell = { row: 0, column: 0 };

  test("the hardest win names the color, and the count is every win", () => {
    const won = { ...cell, wins: { standard: 2, heroic1: 1, expert: 1 }, losses: 3 };
    expect(hardestWin(won)).toBe("heroic1");
    expect(cellLookOf(won, true)).toEqual({ kind: "won", tier: "heroic1", count: 4 });
  });

  test("played and not beaten is its own look, gone with the toggle off", () => {
    const lost = { ...cell, wins: {}, losses: 2 };
    expect(cellLookOf(lost, true)).toEqual({ kind: "played", count: 2 });
    expect(cellLookOf(lost, false)).toEqual({ kind: "unplayed" });
  });

  test("the toggle leaves a won cell with losses alone", () => {
    expect(cellLookOf({ ...cell, wins: { standard: 1 }, losses: 2 }, false).kind).toBe("won");
  });

  test("no cell is unplayed", () => {
    expect(cellLookOf(undefined, true)).toEqual({ kind: "unplayed" });
  });
});

describe("readoutOf", () => {
  const { heroes } = matchupsOf(
    [game({ tier: "heroic2" }), game({ tier: "expert" }), game({ tier: "expert" }), game({ won: false })],
    AXES,
    NAMES,
  );

  test("names the pairing, then each tier hardest first, then the losses", () => {
    expect(readoutOf(heroes, 0, 0)).toEqual({
      title: "Rhino × Spider-Man",
      detail: "Heroic 2: 1 win · Expert: 2 wins · 1 loss",
    });
  });

  test("a pairing with no games says so", () => {
    expect(readoutOf(heroes, 1, 1)).toEqual({ title: "Klaw × Captain Marvel", detail: "Not played yet" });
  });
});

test("legendOf lists only the tiers on show, and the played look only with its toggle", () => {
  const { heroes } = matchupsOf(
    [game({ tier: "expert" }), game({ tier: "standard", scenarioId: "klaw" })],
    AXES,
    NAMES,
  );
  expect(legendOf(heroes, true).map((e) => e.label)).toEqual([
    "Standard",
    "Expert",
    "Played, not beaten",
    "Not played",
  ]);
  expect(legendOf(heroes, false).map((e) => e.label)).toEqual(["Standard", "Expert", "Not played"]);
});

describe("the list views", () => {
  const { heroes } = matchupsOf(
    [
      game({ tier: "expert" }),
      game({ heroIds: ["cap"], tier: "standard" }),
      game({ heroIds: ["cap"], tier: "heroic2" }),
      game({ scenarioId: "klaw", won: false }),
    ],
    AXES,
    NAMES,
  );

  test("a shelf counts each column once, at its hardest win", () => {
    const [rhino, klaw] = shelvesOf(heroes, true);
    expect(rhino).toMatchObject({
      name: "Rhino",
      total: 2,
      best: "heroic2",
      bestLabel: "Heroic 2",
      bar: [
        { tier: "expert", count: 1 },
        { tier: "heroic2", count: 1 },
      ],
      pips: ["heroic2", "expert"],
      score: "2/2",
    });
    expect(klaw).toMatchObject({ best: null, summary: "0 of 2 beaten · 1 tried", pips: ["played", "unplayed"] });
  });

  test("with the toggle off a shelf says nothing of tries", () => {
    expect(shelvesOf(heroes, false)[1]).toMatchObject({ summary: "0 of 2 beaten", pips: ["unplayed", "unplayed"] });
  });

  test("tiles keep the axis order and say what you did", () => {
    expect(tilesOf(heroes, 1, true, false).map((t) => t.ribbon)).toEqual(["Tried", "Not played"]);
    expect(tilesOf(heroes, 0, true, true).map((t) => t.ribbon)).toEqual(["Expert · 1", "Heroic 2 · 2"]);
  });

  test("the rows start with the key, then a shelf each or tiles in rows that fit", () => {
    const shelves = shelfRowsOf(heroes, true, 900, false);
    expect(shelves.map((r) => r.row.kind)).toEqual(["legend", "shelf", "shelf"]);
    const tiles = tileRowsOf(heroes, 0, { showPlayed: true, showCounts: false }, 200, false);
    expect(tiles.map((r) => r.row.kind)).toEqual(["legend", "tiles", "tiles"]);
  });
});

test("the key wraps to the width it has", () => {
  const entries = [
    { kind: "played", label: "Played, not beaten" },
    { kind: "unplayed", label: "Not played" },
  ] as const;
  expect(legendLayoutOf(entries, 1000).height).toBe(22);
  const wrapped = legendLayoutOf(entries, 150);
  expect(wrapped.height).toBe(44);
  expect(wrapped.entries[1]).toMatchObject({ x: 0, y: 22 });
});

describe("the grid's geometry", () => {
  const shape: GridShape = {
    rect: { x: 10, y: 20, width: 300, height: 240 },
    metrics: { cell: 40, rowHeader: 100, columnHeader: 40 },
    rows: 10,
    columns: 12,
  };

  test("the body is the area less the header bands", () => {
    expect(bodyOf(shape)).toEqual({ x: 110, y: 60, width: 200, height: 200 });
  });

  test("a pan stops at the grid's ends, and a grid that fits does not pan", () => {
    expect(clampPan(shape, { x: -5, y: 9999 })).toEqual({ x: 0, y: 200 });
    expect(clampPan({ ...shape, rows: 2, columns: 2 }, { x: 50, y: 50 })).toEqual({ x: 0, y: 0 });
  });

  test("the range covers cells partly in view, and no more than exist", () => {
    expect(visibleRange(shape, { x: 20, y: 0 })).toEqual({ rowFrom: 0, rowTo: 5, columnFrom: 0, columnTo: 6 });
    expect(visibleRange(shape, { x: 280, y: 200 })).toEqual({ rowFrom: 5, rowTo: 10, columnFrom: 7, columnTo: 12 });
  });

  test("a cell's square and the cell under a point agree", () => {
    const pan = { x: 30, y: 50 };
    const rect = cellRect(shape, pan, { row: 2, column: 3 });
    expect(rect).toEqual({ x: 200, y: 90, width: 40, height: 40 });
    expect(cellAt(shape, pan, rect.x + 5, rect.y + 5)).toEqual({ row: 2, column: 3 });
  });

  test("off the body, or past the last cell of a grid that fits, there is no cell", () => {
    expect(cellAt(shape, { x: 0, y: 0 }, 50, 100)).toBeNull();
    expect(cellAt({ ...shape, rows: 1, columns: 1 }, { x: 0, y: 0 }, 200, 200)).toBeNull();
  });

  test("showing a cell moves the pan the least it can", () => {
    expect(panToShow(shape, { x: 0, y: 0 }, { row: 1, column: 1 })).toEqual({ x: 0, y: 0 });
    expect(panToShow(shape, { x: 0, y: 0 }, { row: 6, column: 5 })).toEqual({ x: 40, y: 80 });
    expect(panToShow(shape, { x: 200, y: 200 }, { row: 1, column: 1 })).toEqual({ x: 40, y: 40 });
  });

  test("a pan carries the cursor to the nearest cell wholly in view", () => {
    expect(cursorInView(shape, { x: 0, y: 0 }, { row: 2, column: 2 })).toEqual({ row: 2, column: 2 });
    expect(cursorInView(shape, { x: 100, y: 90 }, { row: 0, column: 0 })).toEqual({ row: 3, column: 3 });
    expect(cursorInView(shape, { x: 0, y: 0 }, { row: 9, column: 9 })).toEqual({ row: 4, column: 4 });
  });

  test("the cursor steps a cell and stops at the edge", () => {
    expect(stepCursor(shape, { row: 3, column: 3 }, "right")).toEqual({ row: 3, column: 4 });
    expect(stepCursor(shape, { row: 0, column: 3 }, "up")).toBeNull();
    expect(stepCursor(shape, { row: 3, column: 11 }, "right")).toBeNull();
  });

  test("a cursor left past a smaller grid comes back on it", () => {
    expect(clampCursor({ ...shape, rows: 4, columns: 4 }, { row: 9, column: 9 })).toEqual({ row: 3, column: 3 });
  });
});
