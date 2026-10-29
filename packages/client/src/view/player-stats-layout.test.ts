import { describe, expect, test } from "vitest";
import type { OverviewTile, PlayerStats } from "./player-stats-model.js";
import { cardRowsOf, dashboardRowsOf, heroAt, statsTabsOf, tileRowsOf } from "./player-stats-layout.js";

const small = (id: string): OverviewTile => ({ kind: "small", id, label: id, value: "1", detail: "" });
const record: OverviewTile = { kind: "record", id: "record", record: "1–0", rate: "", fraction: 1, detail: "" };

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
