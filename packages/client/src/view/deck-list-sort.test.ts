import { describe, expect, test } from "vitest";
import { deckFromStarterDeck } from "@mc/content";
import { POOL_CARDS, POOL_STARTER_DECKS, POOL_VERSION } from "../content/pool.js";
import { deckListGroupsOf, deckListSortLabel, nextDeckListSort, DECK_LIST_SORTS } from "./deck-stats.js";

const deck = deckFromStarterDeck(POOL_STARTER_DECKS[0]!, POOL_VERSION);
const total = (sort: (typeof DECK_LIST_SORTS)[number]): number =>
  deckListGroupsOf(deck, POOL_CARDS, sort).reduce((sum, group) => sum + group.count, 0);

describe("a deck's card list sorts (issue #594)", () => {
  test("every sort lists the same cards", () => {
    for (const sort of DECK_LIST_SORTS) expect(total(sort)).toBe(total("aspect"));
  });

  test("aspect stays the default", () => {
    expect(deckListGroupsOf(deck, POOL_CARDS)).toEqual(deckListGroupsOf(deck, POOL_CARDS, "aspect"));
  });

  test("by name is one group, in name order", () => {
    const groups = deckListGroupsOf(deck, POOL_CARDS, "name");
    expect(groups.map((group) => group.label)).toEqual(["All cards"]);
    const names = groups[0]!.entries.map((entry) => entry.name);
    expect(names).toEqual([...names].sort((a, b) => a.localeCompare(b)));
  });

  test("by cost, the groups rise and a resource sits last with no cost", () => {
    const labels = deckListGroupsOf(deck, POOL_CARDS, "cost").map((group) => group.label);
    expect(labels.at(-1)).toBe("No cost");
    const costs = labels.slice(0, -1).map((text) => Number(text.replace("Cost ", "")));
    expect(costs).toEqual([...costs].sort((a, b) => a - b));
  });

  test("by type, each group holds only its type", () => {
    for (const group of deckListGroupsOf(deck, POOL_CARDS, "type"))
      expect(new Set(group.entries.map((entry) => entry.type))).toEqual(new Set([group.key]));
  });

  test("the control steps through every sort and comes back", () => {
    let sort = DECK_LIST_SORTS[0]!;
    const seen = DECK_LIST_SORTS.map(() => {
      const shown = deckListSortLabel(sort);
      sort = nextDeckListSort(sort);
      return shown;
    });
    expect(seen).toEqual(["Sort: Aspect", "Sort: Type", "Sort: Cost", "Sort: Name"]);
    expect(sort).toBe("aspect");
  });
});
