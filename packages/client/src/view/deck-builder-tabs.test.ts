import { DEFAULT_POOL_SORT } from "./deck-builder-model.js";
import { describe, expect, test } from "vitest";
import {
  activeDeckFilterCount,
  deckBuilderNarrowFocusOrder,
  deckBuilderTabLabel,
  deckBuilderTabRects,
  deckBuilderTabs,
  startTab,
  stepDeckBuilderTab,
  type DeckBuilderNarrowFocusInput,
} from "./deck-builder-tabs.js";

describe("deck builder tabs", () => {
  test("campaign mode has no From your games", () => {
    expect(deckBuilderTabs(false)).toEqual(["pool", "deck", "games"]);
    expect(deckBuilderTabs(true)).toEqual(["pool", "deck"]);
  });

  test("a visit opens on the pool, or on From your games when asked (never in a campaign)", () => {
    expect(startTab(undefined, false)).toBe("pool");
    expect(startTab("deck", false)).toBe("pool");
    expect(startTab("games", false)).toBe("games");
    expect(startTab("games", true)).toBe("pool");
  });

  test("the Deck tab states the counted cards against the minimum", () => {
    expect(deckBuilderTabLabel("pool", 15, 40)).toBe("Pool");
    expect(deckBuilderTabLabel("games", 15, 40)).toBe("From your games");
    expect(deckBuilderTabLabel("deck", 15, 40)).toBe("Deck 15/40");
    expect(deckBuilderTabLabel("deck", 39, 40)).toBe("Deck 39/40");
    expect(deckBuilderTabLabel("deck", 40, 40)).toBe("Deck 40");
    expect(deckBuilderTabLabel("deck", 47, 40)).toBe("Deck 47");
  });

  test("the tab row fills its width, each cell sized by its words", () => {
    const row = { x: 16, y: 100, width: 358, height: 44 };
    const rects = deckBuilderTabRects(["Pool", "Deck 15/40", "From your games"], row, 6);
    expect(rects).toHaveLength(3);
    expect(rects[0]!.x).toBe(16);
    const last = rects[2]!;
    expect(last.x + last.width).toBeCloseTo(16 + 358, 5);
    expect(rects[2]!.width).toBeGreaterThan(rects[1]!.width);
    expect(rects[1]!.width).toBeGreaterThan(rects[0]!.width);
    for (let i = 1; i < rects.length; i++)
      expect(rects[i]!.x).toBeCloseTo(rects[i - 1]!.x + rects[i - 1]!.width + 6, 5);
  });

  test("LB / RB step to the neighbour and stop at the ends", () => {
    const tabs = deckBuilderTabs(false);
    expect(stepDeckBuilderTab(tabs, "pool", 1)).toBe("deck");
    expect(stepDeckBuilderTab(tabs, "deck", 1)).toBe("games");
    expect(stepDeckBuilderTab(tabs, "games", 1)).toBe("games");
    expect(stepDeckBuilderTab(tabs, "pool", -1)).toBe("pool");
    expect(stepDeckBuilderTab(tabs, "games", -1)).toBe("deck");
    expect(stepDeckBuilderTab(deckBuilderTabs(true), "deck", 1)).toBe("deck");
  });

  test("the Filters chip counts the filters that are on", () => {
    expect(activeDeckFilterCount({}, DEFAULT_POOL_SORT)).toBe(0);
    expect(activeDeckFilterCount({ type: null }, DEFAULT_POOL_SORT)).toBe(0);
    expect(activeDeckFilterCount({ type: "ally" }, DEFAULT_POOL_SORT)).toBe(1);
    expect(activeDeckFilterCount({ cost: 0 }, DEFAULT_POOL_SORT)).toBe(1);
    expect(
      activeDeckFilterCount({ type: "ally", packCode: "01", cycleId: "core" }, { primary: "cost", secondary: null }),
    ).toBe(4);
  });
});

describe("deck builder narrow focus order", () => {
  const base: DeckBuilderNarrowFocusInput = {
    tab: "pool",
    tabs: deckBuilderTabs(false),
    campaign: false,
    filtersFolded: true,
    filtersOpen: false,
    filterTextEntered: false,
    aspectIds: ["justice"],
    typeFilterIds: ["all", "ally"],
    quickFilterIds: ["cost:0"],
    oddsIds: [],
    poolCardIds: ["01001", "01002"],
    rewardIds: [],
    showDelete: false,
    showFreeze: false,
    gamesIds: ["games:+ Add:01093"],
  };

  test("the pool tab: search, the folded Filters chip, then cards; no deck or games controls", () => {
    const order = deckBuilderNarrowFocusOrder(base);
    expect(order).toEqual([
      "back",
      "tab:pool",
      "tab:deck",
      "tab:games",
      "filter-text",
      "filter-help",
      "pool-view",
      "filters-toggle",
      "card:01001",
      "card:01002",
    ]);
  });

  test("an open Filters chip adds the chips, an entered search adds its clear button", () => {
    const order = deckBuilderNarrowFocusOrder({ ...base, filtersOpen: true, filterTextEntered: true });
    expect(order).toContain("filter-clear");
    expect(order).toContain("type:all");
    expect(order).toContain("pack:sort");
    expect(order.indexOf("filters-toggle")).toBeLessThan(order.indexOf("type:all"));
  });

  test("unfolded filters (a tablet) are always on the route and have no chip", () => {
    const order = deckBuilderNarrowFocusOrder({ ...base, filtersFolded: false });
    expect(order).not.toContain("filters-toggle");
    expect(order).toContain("pack:cycle");
  });

  test("the deck tab ends at Save and leaves the pool out", () => {
    const order = deckBuilderNarrowFocusOrder({ ...base, tab: "deck", showDelete: true });
    expect(order.slice(-7)).toEqual(["name", "deck-sort", "deck-review", "preconstructed", "clear", "delete", "save"]);
    expect(order).toContain("aspect:justice");
    expect(order.some((key) => key.startsWith("card:") || key === "filter-text")).toBe(false);
  });

  test("the games tab has only its own rows", () => {
    expect(deckBuilderNarrowFocusOrder({ ...base, tab: "games" })).toEqual([
      "back",
      "tab:pool",
      "tab:deck",
      "tab:games",
      "games:+ Add:01093",
    ]);
  });

  test("campaign mode: two tabs, no name or Precon / Clear, rewards and Save stay", () => {
    const order = deckBuilderNarrowFocusOrder({
      ...base,
      tab: "deck",
      tabs: deckBuilderTabs(true),
      campaign: true,
      rewardIds: ["0:27001"],
      showFreeze: true,
    });
    expect(order).toEqual([
      "back",
      "tab:pool",
      "tab:deck",
      "aspect:justice",
      "reward:0:27001",
      "deck-sort",
      "freeze-deck",
      "save",
    ]);
  });
});
