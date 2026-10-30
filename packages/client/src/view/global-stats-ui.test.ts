import { describe, expect, test } from "vitest";
import type { GlobalStats } from "@mc/sync-worker/global-protocol";
import { NAMES } from "../global-stats/fixtures.js";
import {
  NOTE_EMPTY,
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
    expect(view({ kind: "ready", data: STATS, stale: false }, "villains").notes).toEqual([NOTE_EMPTY]);
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
