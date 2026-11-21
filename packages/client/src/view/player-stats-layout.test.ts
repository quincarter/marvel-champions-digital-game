import { describe, expect, test } from "vitest";
import type { OverviewTile, PlayerStats } from "./player-stats-model.js";
import {
  SHOWCASE_MIN_WIDTH,
  cardRowsOf,
  dashboardRowsOf,
  heroAt,
  overviewRowsOf,
  statRowPicture,
  statsTabsOf,
  tileRowsOf,
} from "./player-stats-layout.js";

const small = (id: string): OverviewTile => ({ kind: "small", id, label: id, value: "1", detail: "" });
const record: OverviewTile = { kind: "record", id: "record", record: "1–0", rate: "", fraction: 1, detail: "" };

test("a stat row's picture is a card-shaped thumbnail at the row's left, whatever the row's width", () => {
  const wide = statRowPicture({ x: 24, y: 100, width: 1378, height: 52 });
  expect(wide).toEqual({ x: 30, y: 105, width: 30, height: 42 });
  expect(statRowPicture({ x: 24, y: 100, width: 300, height: 52 })).toEqual(wide);
});

const STATS: PlayerStats = {
  header: { record: "1–0", rate: "", played: "", streak: "", fraction: 1 },
  sections: [
    { id: "overview", title: "Overview", count: "", rows: [] },
    { id: "heroes", title: "Heroes", count: "", rows: [{ kind: "stat", id: "h", label: "A", value: "1", detail: "" }] },
  ],
  overview: { tiles: [record, small("a"), small("b")], note: "older" },
  heroCards: [
    { identityCardId: "x", name: "X", games: "1", aspects: [], groups: [], note: null },
    { identityCardId: "y", name: "Y", games: "1", aspects: [], groups: [], note: null },
  ],
  allCards: {
    identityCardId: "",
    name: "Every hero",
    games: "2",
    aspects: [],
    groups: [{ id: "all:played", title: "Most played", cards: [{ cardId: "c", value: "2×", detail: "" }] }],
    note: null,
  },
  aspects: [{ aspect: "justice", label: "Justice", games: 2, wins: 1 }],
  decks: [],
  matchups: null,
  filter: {},
  filterOptions: { heroes: [], villains: [], difficulties: [] },
};

describe("statsTabsOf", () => {
  test("Overview always; a tab per section the stats have, then Cards by hero", () => {
    expect(statsTabsOf(STATS).map((t) => t.id)).toEqual(["overview", "heroes", "all-cards", "cards"]);
  });
});

describe("tileRowsOf", () => {
  test("four columns on a wide screen: the record takes two, so two small tiles fit beside it", () => {
    const rows = tileRowsOf([record, small("a"), small("b"), small("c")], 1000, false);
    expect(rows).toHaveLength(2);
    const first = rows[0]!;
    expect(first.kind === "tiles" && first.tiles.map((t) => t.tile.id)).toEqual(["record", "a", "b"]);
  });

  test("two columns on a phone: the record takes the row, small tiles go two by two", () => {
    const rows = tileRowsOf([record, small("a"), small("b"), small("c")], 358, true);
    expect(rows.map((r) => (r.kind === "tiles" ? r.tiles.length : 0))).toEqual([1, 2, 1]);
  });

  test("tiles in a row sit side by side without overlapping and fit the width", () => {
    const row = tileRowsOf([record, small("a"), small("b")], 1000, false)[0]!;
    if (row.kind !== "tiles") throw new Error("tiles");
    for (let i = 1; i < row.tiles.length; i++) {
      expect(row.tiles[i]!.x).toBeGreaterThan(row.tiles[i - 1]!.x + row.tiles[i - 1]!.width);
    }
    const last = row.tiles.at(-1)!;
    expect(last.x + last.width).toBeLessThanOrEqual(1000.001);
  });
});

describe("overviewRowsOf", () => {
  const hero: OverviewTile = {
    kind: "portrait",
    id: "hero",
    label: "Favorite hero",
    name: "She-Hulk",
    detail: "",
    extra: "",
    art: { hero: "x" },
    wide: true,
  };
  const tiles = [record, small("a"), hero, small("b"), small("c"), small("d"), small("e")];
  const boxes = (row: ReturnType<typeof overviewRowsOf>[number]) => {
    if (row.kind !== "tiles") throw new Error("tiles");
    return row.tiles.map((p) => ({
      id: p.tile.id,
      x: p.x,
      y: p.y ?? 0,
      width: p.width,
      height: p.height ?? row.height - 14,
      tall: p.tall ?? false,
    }));
  };

  test("a wide screen stands the favorite hero tall at the far left, with the other tiles stacked beside it", () => {
    const rows = overviewRowsOf(tiles, 1400, false);
    const placed = boxes(rows[0]!);
    const heroBox = placed.find((p) => p.id === "hero")!;
    expect(heroBox).toMatchObject({ x: 0, y: 0, tall: true });
    // A portrait: taller than it is wide, and as tall as the stack beside it.
    expect(heroBox.height).toBeGreaterThan(heroBox.width);
    const beside = placed.filter((p) => p.id !== "hero");
    expect(beside.map((p) => p.id)).toEqual(["record", "a", "b", "c", "d", "e"]);
    for (const p of beside) {
      expect(p.x).toBeGreaterThan(heroBox.x + heroBox.width);
      expect(p.x + p.width).toBeLessThanOrEqual(1400.001);
      expect(p.y + p.height).toBeLessThanOrEqual(heroBox.height + 0.001);
    }
    // The record leads the stack, two columns of three.
    expect(beside[0]).toMatchObject({ id: "record", y: 0 });
  });

  test("no two tiles in the showcase overlap", () => {
    const placed = boxes(overviewRowsOf(tiles, 1400, false)[0]!);
    for (const a of placed)
      for (const b of placed) {
        if (a === b) continue;
        const apart = a.x + a.width <= b.x || b.x + b.width <= a.x || a.y + a.height <= b.y || b.y + b.height <= a.y;
        expect(apart, `${a.id} and ${b.id}`).toBe(true);
      }
  });

  test("tiles that would stretch the stack far past the portrait continue below in the four-column grid", () => {
    const many = [record, hero, ...Array.from({ length: 30 }, (_, i) => small(`s${i}`))];
    const rows = overviewRowsOf(many, 1400, false);
    expect(rows.length).toBeGreaterThan(1);
    const shown = rows.flatMap((row) => (row.kind === "tiles" ? row.tiles.map((p) => p.tile.id) : []));
    expect(new Set(shown).size).toBe(many.length);
    const below = rows[1]!;
    expect(below.kind === "tiles" && below.tiles.length).toBe(4);
  });

  test("a phone, a narrow window or no favorite hero keeps the plain grid", () => {
    expect(overviewRowsOf(tiles, 358, true)).toEqual(tileRowsOf(tiles, 358, true));
    expect(overviewRowsOf(tiles, SHOWCASE_MIN_WIDTH - 1, false)).toEqual(
      tileRowsOf(tiles, SHOWCASE_MIN_WIDTH - 1, false),
    );
    const noHero = tiles.filter((t) => t !== hero);
    expect(overviewRowsOf(noHero, 1400, false)).toEqual(tileRowsOf(noHero, 1400, false));
  });
});

describe("cardRowsOf", () => {
  test("as many cards across as fit, the rest on the next strip", () => {
    const cards = Array.from({ length: 5 }, (_, i) => ({ cardId: `c${i}`, value: "1×", detail: "" }));
    const rows = cardRowsOf("g", cards, 358, true);
    expect(rows.map((r) => (r.kind === "cards" ? r.cards.length : 0))).toEqual([3, 2]);
  });
});

describe("dashboardRowsOf", () => {
  test("Overview is its tile rows and the older-games note", () => {
    const rows = dashboardRowsOf(STATS, "overview", 0, 1000, false);
    expect(rows.at(-1)).toMatchObject({ kind: "note", text: "older" });
  });

  test("Cards is a heading and a strip of pictures per group", () => {
    expect(dashboardRowsOf(STATS, "all-cards", 0, 1000, false).map((r) => r.kind)).toEqual(["heading", "cards"]);
  });

  test("a list tab is its section's rows", () => {
    expect(dashboardRowsOf(STATS, "heroes", 0, 1000, false).map((r) => r.id)).toEqual(["h"]);
  });

  test("the hero index wraps both ways", () => {
    expect(heroAt(STATS, 2)?.identityCardId).toBe("x");
    expect(heroAt(STATS, -1)?.identityCardId).toBe("y");
  });
});

describe("the merged list tabs", () => {
  const withSections = (ids: string[]): PlayerStats => ({
    ...STATS,
    sections: ids.map((id) => ({
      id,
      title: id,
      count: "",
      rows: [{ kind: "stat" as const, id: `${id}:row`, label: id, value: "1", detail: "" }],
    })),
  });

  test("Encounter holds modular sets and side schemes, Records holds records and devices, each headed", () => {
    const stats = withSections(["overview", "encounter", "side-schemes", "records", "devices"]);
    expect(statsTabsOf(stats).map((t) => t.id)).toEqual(["overview", "encounter", "records", "all-cards", "cards"]);
    expect(dashboardRowsOf(stats, "encounter", 0, 1000, false).map((r) => r.id)).toEqual([
      "encounter:head",
      "encounter:row",
      "side-schemes:head",
      "side-schemes:row",
    ]);
  });

  test("Aspects opens with the donut", () => {
    const rows = dashboardRowsOf(withSections(["overview", "aspects"]), "aspects", 0, 1000, false);
    expect(rows.map((r) => r.kind)).toEqual(["donut", "stat"]);
  });
});

describe("Hide hero cards", () => {
  test("Cards leaves a hero's own cards out, and a group left empty loses its heading", () => {
    const stats: PlayerStats = {
      ...STATS,
      allCards: {
        ...STATS.allCards!,
        groups: [
          {
            id: "all:played",
            title: "Most played",
            cards: [{ cardId: "webs", value: "2×", detail: "", signature: true }],
          },
          {
            id: "all:activated",
            title: "Most activated",
            cards: [
              { cardId: "webs", value: "3×", detail: "", signature: true },
              { cardId: "tac", value: "1×", detail: "" },
            ],
          },
        ],
      },
    };
    const ids = (hide: boolean) => dashboardRowsOf(stats, "all-cards", 0, 1000, false, hide).map((r) => r.id);
    expect(ids(false)).toEqual([
      "all:played:head",
      "all:played:strip:0",
      "all:activated:head",
      "all:activated:strip:0",
    ]);
    expect(ids(true)).toEqual(["all:activated:head", "all:activated:strip:0"]);
  });
});
