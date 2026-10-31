import { describe, expect, test } from "vitest";
import type { GlobalStats } from "@mc/sync-worker/global-protocol";
import { NAMES } from "../global-stats/fixtures.js";
import {
  GLOBAL_TABS,
  NOTE_EMPTY,
  emptyNoteOf,
  settleSource,
  statsTabsFor,
  switchSource,
  NOTE_FILTERS,
  NOTE_READING,
  NOTE_STALE,
  NOTE_UNAVAILABLE,
  globalRowButton,
  globalRowDetail,
  globalTabViewOf,
  hasGlobalSource,
} from "./global-stats-ui.js";
import { globalRowsOf, type StatsTab } from "./player-stats-layout.js";

const STATS: GlobalStats = {
  updatedAt: 1,
  games: 100,
  heroes: [{ key: "spidey", games: 60, wins: 45, causes: { minions: 15 } }],
  villains: [],
  modulars: [],
};

describe("the ask's words", () => {
  test("the Settings row says its state and the action", () => {
    expect(globalRowDetail("on").startsWith("On.")).toBe(true);
    expect(globalRowDetail("unset").startsWith("Off.")).toBe(true);
    expect(globalRowButton("on")).toBe("Turn off");
    expect(globalRowButton("off")).toBe("Turn on");
  });
});

describe("the You / Everyone switch", () => {
  const own: StatsTab[] = ["overview", "heroes", "villains", "records"];
  const youOn = (tab: StatsTab, cameFrom: StatsTab | null = null) => ({ source: "you" as const, tab, cameFrom });

  test("Everyone always has Heroes, Villains and Encounter, even for a player with no games", () => {
    const ids = (tabs: readonly { id: StatsTab }[]) => tabs.map((t) => t.id);
    expect(ids(statsTabsFor("everyone", [{ id: "overview", label: "Overview" }]))).toEqual([
      "heroes",
      "villains",
      "encounter",
    ]);
    expect(statsTabsFor("everyone", [])).toBe(GLOBAL_TABS);
    const mine = [{ id: "overview" as const, label: "Overview" }];
    expect(statsTabsFor("you", mine)).toBe(mine);
  });

  test("Everyone from Overview lands on Villains; You returns to Overview", () => {
    const everyone = switchSource(youOn("overview"), "everyone", own);
    expect(everyone).toEqual({ source: "everyone", tab: "villains", cameFrom: "overview" });
    expect(switchSource(everyone, "you", own)).toEqual({ source: "you", tab: "overview", cameFrom: null });
  });

  test("Everyone from a tab it has stays there; You returns to that tab", () => {
    const everyone = switchSource(youOn("heroes"), "everyone", own);
    expect(everyone.tab).toBe("heroes");
    const moved = { ...everyone, tab: "encounter" as const };
    expect(switchSource(moved, "you", own).tab).toBe("heroes");
  });

  test("You returns to Overview when the tab it came from is gone", () => {
    const from = { source: "everyone" as const, tab: "villains" as const, cameFrom: "aspects" as const };
    expect(switchSource(from, "you", own).tab).toBe("overview");
    expect(switchSource({ ...from, cameFrom: null }, "you", own).tab).toBe("overview");
  });

  test("Everyone kept from an earlier visit on Overview settles on Villains", () => {
    expect(settleSource({ source: "everyone", tab: "overview", cameFrom: null })).toEqual({
      source: "everyone",
      tab: "villains",
      cameFrom: "overview",
    });
    const fine = { source: "everyone" as const, tab: "heroes" as const, cameFrom: null };
    expect(settleSource(fine)).toBe(fine);
  });
});

describe("globalTabViewOf", () => {
  const view = (state: Parameters<typeof globalTabViewOf>[0], tab: StatsTab = "heroes", filtered = false) =>
    globalTabViewOf(state, tab, NAMES, filtered);

  test("only Heroes, Villains and Encounter offer Everyone", () => {
    expect(["heroes", "villains", "encounter"].every((t) => hasGlobalSource(t as never))).toBe(true);
    expect(["overview", "aspects", "cards", "records"].some((t) => hasGlobalSource(t as never))).toBe(false);
  });

  test("reading and unavailable are notes with no rows", () => {
    expect(view({ kind: "reading" })).toEqual({ notes: [NOTE_READING], section: null });
    expect(view({ kind: "idle" }).notes).toEqual([NOTE_READING]);
    expect(view({ kind: "unavailable" })).toEqual({ notes: [NOTE_UNAVAILABLE], section: null });
    expect(view({ kind: "none" }).notes).toEqual([NOTE_EMPTY]);
  });

  test("ready gives the tab's section; a tab with no rows says there are too few games", () => {
    const heroes = view({ kind: "ready", data: STATS, stale: false });
    expect(heroes.notes).toEqual([]);
    expect(heroes.section?.id).toBe("global:heroes");
    expect(view({ kind: "ready", data: STATS, stale: false }, "villains").notes).toEqual([emptyNoteOf(100)]);
  });

  test("the empty note says why: 20 shared games, and how many so far when known", () => {
    expect(emptyNoteOf(4)).toBe("Rows appear once a villain, hero or set has 20 shared games. 4 games shared so far.");
    expect(emptyNoteOf(1)).toContain("1 game shared so far.");
    expect(emptyNoteOf(0)).toContain("0 games shared so far.");
    // No count is known for `none`: only the first sentence.
    expect(emptyNoteOf(null)).toBe(NOTE_EMPTY);
    expect(NOTE_EMPTY).not.toContain("so far");
  });

  test("a stale copy says so above its rows", () => {
    const stale = view({ kind: "ready", data: STATS, stale: true });
    expect(stale.notes).toEqual([NOTE_STALE]);
    expect(stale.section).not.toBeNull();
  });

  test("set filters are named as not applying", () => {
    expect(view({ kind: "unavailable" }, "heroes", true).notes).toEqual([NOTE_FILTERS, NOTE_UNAVAILABLE]);
  });

  test("the hero rows lead with the hero's card; notes and rows lay out as list rows", () => {
    const { notes, section } = view({ kind: "ready", data: STATS, stale: true });
    const rows = globalRowsOf(notes, section, true);
    expect(rows.map((r) => r.kind)).toEqual(["note", "stat"]);
    const stat = rows[1]!;
    expect(stat.kind === "stat" && stat.row.cardId).toBe("spidey");
    // A hero with losses gets the taller row for its loss bar.
    expect(stat.height).toBeGreaterThan(rows[0]!.height);
  });
});
