import { describe, expect, it } from "vitest";
import { EXTRAS_ENTRIES, Extras, NO_EXTRAS_PROGRESS } from "../progression/extras.js";
import {
  extrasGridOf,
  extrasRowCount,
  extrasSummaryOf,
  extrasTabsOf,
  extrasTileAt,
  extrasTileRect,
  extrasTilesOf,
} from "./extras-model.js";

const fresh = new Extras(NO_EXTRAS_PROGRESS);

describe("extras tabs and tiles", () => {
  it("counts each tab's open entries out of its total", () => {
    const tabs = extrasTabsOf(fresh);
    expect(tabs.map((tab) => tab.id)).toEqual(["stories", "books", "heroes", "villains", "art", "music"]);
    expect(tabs[0]!.label).toBe(`Stories 0/${EXTRAS_ENTRIES.stories.length}`);
  });

  it("gives a locked tile its hint and an open one its call to action", () => {
    const heroes = extrasTilesOf(new Extras({ ...NO_EXTRAS_PROGRESS, playedHeroIds: ["01001a"] }), "heroes");
    const spiderMan = heroes.find((tile) => tile.id === "hero:01001a")!;
    expect(spiderMan).toMatchObject({ open: true, hint: null, action: "VIEW", subtitle: "Peter Parker" });
    const locked = heroes.find((tile) => tile.id === "hero:01010a")!;
    expect(locked.open).toBe(false);
    expect(locked.hint).toBe("Finish a game as Captain Marvel");
    expect(extrasTilesOf(fresh, "stories")[0]!.action).toBe("READ");
    expect(extrasTilesOf(fresh, "music")[0]!.action).toBe("PLAY");
  });

  it("sums every tab for the top bar", () => {
    expect(extrasSummaryOf(new Extras(NO_EXTRAS_PROGRESS, { everything: true }))).toMatch(/^(\d+) of \1 open$/);
  });
});

describe("the extras grid", () => {
  it("keeps two columns on a phone and adds columns as the width allows", () => {
    expect(extrasGridOf(358, "heroes", true).columns).toBe(2);
    expect(extrasGridOf(1200, "heroes", false).columns).toBeGreaterThanOrEqual(6);
  });

  it("lays music out as one song per row", () => {
    const grid = extrasGridOf(800, "music", false);
    expect(grid.columns).toBe(1);
    expect(extrasRowCount(5, grid)).toBe(5);
  });

  it("fills a row's width exactly, and finds the tile under a tap", () => {
    const grid = extrasGridOf(1000, "art", false);
    const last = extrasTileRect(grid.columns - 1, grid, { x: 20, y: 0 });
    expect(last.x + last.width).toBeCloseTo(1020);
    expect(extrasTileAt(last.x + 1, 1, grid, 20, 100)).toBe(grid.columns * 2 - 1);
    expect(extrasTileAt(20 + grid.tileWidth + grid.gap / 2, 0, grid, 20, 100)).toBeNull();
    expect(extrasTileAt(last.x + 1, 0, grid, 20, 2)).toBeNull();
  });
});
