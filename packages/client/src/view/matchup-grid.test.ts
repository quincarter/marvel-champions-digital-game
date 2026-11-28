import { describe, expect, test } from "vitest";
import {
  byDesigner,
  designerLines,
  cellLookOf,
  flipGrid,
  hardestWin,
  legendOf,
  matchupsOf,
  readoutOf,
  shelvesOf,
  tilesOf,
  winTierOf,
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

describe("designer credits on the axes (issue #937)", () => {
  test("byDesigner tags custom content and designerLines splits it back for a narrow row or column", () => {
    expect(byDesigner("The Rose", "PermaKarma")).toBe("The Rose (by PermaKarma)");
    expect(byDesigner("Rhino", undefined)).toBe("Rhino");
    expect(designerLines("The Rose (by PermaKarma)")).toEqual(["The Rose", "by PermaKarma"]);
    expect(designerLines("THE ROSE (BY PERMAKARMA)")).toEqual(["THE ROSE", "BY PERMAKARMA"]);
    expect(designerLines("Throg (by A & B)")).toEqual(["Throg", "by A & B"]);
    expect(designerLines("Spider-Man (Peter Parker)")).toBeNull();
  });
});

describe("the list views' folds", () => {
  const grid = matchupsOf([game({ tier: "expert" }), game({ scenarioId: "klaw", won: false })], AXES, NAMES).heroes;

  test("a shelf counts what a villain has beaten, tried and not played, wins first", () => {
    const [rhino, klaw] = shelvesOf(grid, true);
    expect(rhino!.summary).toBe("1 of 2 beaten");
    expect(rhino!.best).toBe("expert");
    expect(rhino!.pips).toEqual(["expert", "unplayed"]);
    expect(klaw!.summary).toBe("0 of 2 beaten · 1 tried");
    expect(klaw!.pips).toEqual(["played", "unplayed"]);
    expect(rhino!.score).toBe("1/2");
  });

  test("the Focus view's tiles say what you did in words, with counts when asked", () => {
    const tiles = tilesOf(grid, 0, true, true);
    expect(tiles.map((tile) => tile.ribbon)).toEqual(["Expert · 1", "Not played"]);
    expect(tilesOf(grid, 1, true, false)[0]!.ribbon).toBe("Tried");
  });
});
