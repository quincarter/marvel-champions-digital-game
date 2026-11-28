import { describe, expect, test } from "vitest";
import type { OverviewTile, PlayerStats } from "./player-stats-model.js";
import { dashboardBlocksOf } from "./player-stats-blocks.js";
import { heroAt, statsTabsOf } from "./player-stats-tabs.js";

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

describe("dashboardBlocksOf", () => {
  test("Overview is its tiles and the older-games note", () => {
    const rows = dashboardBlocksOf(STATS, "overview", 0);
    expect(rows.map((r) => r.kind)).toEqual(["tiles", "note"]);
    expect(rows.at(-1)).toMatchObject({ kind: "note", text: "older" });
  });

  test("Cards is a heading and a strip of pictures per group", () => {
    expect(dashboardBlocksOf(STATS, "all-cards", 0).map((r) => r.kind)).toEqual(["heading", "cards"]);
  });

  test("a list tab is its section's rows", () => {
    expect(dashboardBlocksOf(STATS, "heroes", 0).map((r) => r.id)).toEqual(["h"]);
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
    expect(dashboardBlocksOf(stats, "encounter", 0).map((r) => r.id)).toEqual([
      "encounter:head",
      "encounter:row",
      "side-schemes:head",
      "side-schemes:row",
    ]);
  });

  test("Aspects opens with the donut", () => {
    const rows = dashboardBlocksOf(withSections(["overview", "aspects"]), "aspects", 0);
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
    const ids = (hide: boolean) => dashboardBlocksOf(stats, "all-cards", 0, hide).map((r) => r.id);
    expect(ids(false)).toEqual([
      "all:played:head",
      "all:played:strip:0",
      "all:activated:head",
      "all:activated:strip:0",
    ]);
    expect(ids(true)).toEqual(["all:activated:head", "all:activated:strip:0"]);
  });
});
