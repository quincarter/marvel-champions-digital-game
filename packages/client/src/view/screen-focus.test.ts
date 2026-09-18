import { describe, expect, test } from "vitest";
import { stepKey } from "./focus.js";
import {
  deckBuilderFocusOrder,
  decksFocusOrder,
  scenarioSelectFocusOrder,
  seatsFocusOrder,
  tableSetupFocusOrder,
  titleFocusOrder,
  titleMenuFocusOrder,
  villainPhaseFocusOrder,
} from "./screen-focus.js";

describe("screen focus routes", () => {
  test("the Title screen reads top to bottom, with Continue first only when there is a game to continue", () => {
    const input = { continuable: false, scenarioIds: ["rhino", "klaw"], difficulties: ["standard", "expert"], deckIds: ["a", "b"] };
    expect(titleFocusOrder(input)).toEqual([
      "scenario-search",
      "scenario:rhino",
      "scenario:klaw",
      "difficulty:standard",
      "difficulty:expert",
      "hero-search",
      "hero:a",
      "hero:b",
      "seed",
      "new-seed",
      "start",
    ]);
    expect(titleFocusOrder({ ...input, continuable: true })[0]).toBe("continue");
  });

  test("an empty search result gets a Clear stop instead of any row stops", () => {
    const input = { continuable: false, scenarioIds: [], difficulties: ["standard"], deckIds: [] };
    expect(titleFocusOrder(input)).toEqual(["scenario-search", "scenario-clear", "difficulty:standard", "hero-search", "hero-clear", "seed", "new-seed", "start"]);
  });

  test("Title gains a Manage decks stop, after the hero seats, only when it's shown", () => {
    const input = { continuable: false, scenarioIds: ["rhino"], difficulties: ["standard"], deckIds: ["a", "b"] };
    expect(titleFocusOrder(input)).not.toContain("manage-decks");
    expect(titleFocusOrder({ ...input, manageDecks: true })).toEqual([
      "scenario-search",
      "scenario:rhino",
      "difficulty:standard",
      "hero-search",
      "hero:a",
      "hero:b",
      "manage-decks",
      "seed",
      "new-seed",
      "start",
    ]);
  });

  test("quick-filter chip stops sit between each search field and its rows, and are absent when there are none", () => {
    const input = { continuable: false, scenarioIds: ["rhino"], difficulties: ["standard"], deckIds: ["a"] };
    expect(titleFocusOrder(input)).not.toContain("scenario-chip:product:core");
    expect(titleFocusOrder(input)).not.toContain("hero-chip:aspect:justice");
    const withChips = titleFocusOrder({ ...input, scenarioChipIds: ["product:core"], heroChipIds: ["aspect:justice", "playable-now"] });
    expect(withChips).toEqual([
      "scenario-search",
      "scenario-chip:product:core",
      "scenario:rhino",
      "difficulty:standard",
      "hero-search",
      "hero-chip:aspect:justice",
      "hero-chip:playable-now",
      "hero:a",
      "seed",
      "new-seed",
      "start",
    ]);
  });

  test("Breakout's own difficulty stops (including extreme) sit in the normal difficulty row — no separate per-villain row", () => {
    const input = { continuable: false, scenarioIds: ["breakout"], difficulties: ["standard", "expert", "extreme"], deckIds: ["a"] };
    const order = titleFocusOrder(input);
    expect(order).toEqual(["scenario-search", "scenario:breakout", "difficulty:standard", "difficulty:expert", "difficulty:extreme", "hero-search", "hero:a", "seed", "new-seed", "start"]);
  });

  test("the Decks screen gives every deck row a stop, not just the ones currently on screen", () => {
    const base = {
      showMarvelCdbImport: false,
      deckIds: ["p1", "s1", "s2"],
      editableDeckIds: new Set(["s1", "s2"]),
    };
    expect(decksFocusOrder(base)).toEqual([
      "back",
      "paste-field",
      "paste-import",
      "new-deck",
      "deck:p1",
      "deck:s1",
      "deck:s1:edit",
      "deck:s1:delete",
      "deck:s2",
      "deck:s2:edit",
      "deck:s2:delete",
    ]);
    expect(decksFocusOrder({ ...base, showMarvelCdbImport: true })).toContain("marvelcdb-field");
    expect(decksFocusOrder({ ...base, showMarvelCdbImport: true })).toContain("marvelcdb-import");
  });

  test("the deck builder shows only the identity picker until one is chosen, then the rest", () => {
    const picking = deckBuilderFocusOrder({
      identityChosen: false,
      identityIds: ["hero-a", "hero-b"],
      aspectIds: ["justice"],
      poolCardIds: ["c1"],
    });
    expect(picking).toEqual(["back", "identity:hero-a", "identity:hero-b"]);

    const building = deckBuilderFocusOrder({
      identityChosen: true,
      identityIds: ["hero-a"],
      aspectIds: ["justice", "aggression"],
      poolCardIds: ["c1", "c2", "c3"],
    });
    expect(building).toEqual(["back", "aspect:justice", "aspect:aggression", "name", "filter-text", "card:c1", "card:c2", "card:c3", "save"]);
  });

  test("the walkthrough offers Continue first once the phase is over", () => {
    expect(villainPhaseFocusOrder(false)).toEqual(["skip"]);
    expect(villainPhaseFocusOrder(true)).toEqual(["continue", "skip"]);
  });

  test("the Title menu (W2's D01) is Continue (when there's one), New game, Decks, Campaign, Settings", () => {
    expect(titleMenuFocusOrder({ continuable: false })).toEqual(["new-game", "decks", "campaign", "settings"]);
    expect(titleMenuFocusOrder({ continuable: true })).toEqual(["continue", "new-game", "decks", "campaign", "settings"]);
  });

  test("Scenario select: Back, search, chips, rows (or Clear), then next", () => {
    expect(scenarioSelectFocusOrder({ scenarioIds: ["rhino", "klaw"] })).toEqual(["back", "scenario-search", "scenario:rhino", "scenario:klaw", "next"]);
    expect(scenarioSelectFocusOrder({ scenarioIds: [] })).toEqual(["back", "scenario-search", "scenario-clear", "next"]);
    expect(scenarioSelectFocusOrder({ scenarioIds: ["rhino"], scenarioChipIds: ["product:core"] })).toEqual([
      "back",
      "scenario-search",
      "scenario-chip:product:core",
      "scenario:rhino",
      "next",
    ]);
  });

  test("Take your seats: Back, use-preconstructed, search, chips, rows (or Clear), then deck check (the one red CTA)", () => {
    expect(seatsFocusOrder({ deckIds: ["a", "b"] })).toEqual(["back", "use-preconstructed", "hero-search", "hero:a", "hero:b", "deck-check"]);
    expect(seatsFocusOrder({ deckIds: [] })).toEqual(["back", "use-preconstructed", "hero-search", "hero-clear", "deck-check"]);
    expect(seatsFocusOrder({ deckIds: ["a"], heroChipIds: ["aspect:justice"] })).toEqual([
      "back",
      "use-preconstructed",
      "hero-search",
      "hero-chip:aspect:justice",
      "hero:a",
      "deck-check",
    ]);
  });

  test("Table setup: Back, difficulty, modular sets, first-player options, seed, reroll, then Deal it out", () => {
    const order = tableSetupFocusOrder({
      difficulties: ["standard", "expert"],
      modularSetIds: ["bomb_scare", "masters_of_evil"],
      firstPlayerOptionIds: ["0", "1", "random"],
    });
    expect(order).toEqual([
      "back",
      "difficulty:standard",
      "difficulty:expert",
      "modular:bomb_scare",
      "modular:masters_of_evil",
      "first-player:0",
      "first-player:1",
      "first-player:random",
      "seed",
      "reroll",
      "deal-it-out",
    ]);
  });

  test("Table setup with no modular sets (Breakout) simply omits that stretch", () => {
    const order = tableSetupFocusOrder({ difficulties: ["standard"], modularSetIds: [], firstPlayerOptionIds: ["0", "random"] });
    expect(order).toEqual(["back", "difficulty:standard", "first-player:0", "first-player:random", "seed", "reroll", "deal-it-out"]);
  });

  test("stepping a key route wraps, and starts from either end", () => {
    const order = ["a", "b", "c"];
    expect(stepKey(order, null, 1)).toBe("a");
    expect(stepKey(order, null, -1)).toBe("c");
    expect(stepKey(order, "c", 1)).toBe("a");
    expect(stepKey(order, "a", -1)).toBe("c");
    // A stop that left the route (Continue disappearing) restarts the walk.
    expect(stepKey(order, "gone", 1)).toBe("a");
    expect(stepKey([], null, 1)).toBeNull();
  });
});
