import { describe, expect, test } from "vitest";
import { stepKey } from "./focus.js";
import {
  deckBuilderFocusOrder,
  deckCheckFocusOrder,
  decksFocusOrder,
  pauseFocusOrder,
  rulesFocusOrder,
  scenarioSelectFocusOrder,
  seatsFocusOrder,
  setupWalkthroughFocusOrder,
  settingsFocusOrder,
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

  test("the Decks screen (W9): wide reaches the list and the selected deck's stats-pane actions in one route", () => {
    const base = {
      showMarvelCdbImport: false,
      deckIds: ["p1", "s1", "s2"],
      chipIds: ["aspect:justice", "legal-only"],
      wide: true,
      activeTab: "decks" as const,
      hasSelection: true,
      editable: true,
    };
    expect(decksFocusOrder(base)).toEqual([
      "back",
      "deck-search",
      "deck-chip:aspect:justice",
      "deck-chip:legal-only",
      "deck:p1",
      "deck:s1",
      "deck:s2",
      "paste-field",
      "paste-import",
      "new-deck",
      "stats-check",
      "stats-duplicate",
      "stats-export",
      "stats-edit",
      "stats-delete",
      "stats-play",
    ]);
    expect(decksFocusOrder({ ...base, showMarvelCdbImport: true })).toContain("marvelcdb-field");
    expect(decksFocusOrder({ ...base, showMarvelCdbImport: true })).toContain("marvelcdb-import");
    // A precon (or any non-editable deck) selected: no Edit/Delete stop.
    expect(decksFocusOrder({ ...base, editable: false })).not.toContain("stats-edit");
    expect(decksFocusOrder({ ...base, editable: false })).not.toContain("stats-delete");
    // Nothing selected yet: the stats pane contributes no stops at all.
    expect(decksFocusOrder({ ...base, hasSelection: false })).not.toContain("stats-play");
  });

  test("the Decks screen: narrow reaches only the active tab's own group, behind Back and the tab strip", () => {
    const base = {
      showMarvelCdbImport: false,
      deckIds: ["p1"],
      chipIds: [],
      wide: false,
      hasSelection: true,
      editable: false,
    };
    expect(decksFocusOrder({ ...base, activeTab: "decks" })).toEqual(["back", "tab:decks", "tab:stats", "deck-search", "deck:p1", "paste-field", "paste-import", "new-deck"]);
    expect(decksFocusOrder({ ...base, activeTab: "stats" })).toEqual(["back", "tab:decks", "tab:stats", "stats-check", "stats-duplicate", "stats-export", "stats-play"]);
  });

  test("the deck builder shows only the identity picker until one is chosen, then the rest", () => {
    const picking = deckBuilderFocusOrder({
      identityChosen: false,
      identityIds: ["hero-a", "hero-b"],
      aspectIds: ["justice"],
      typeFilterIds: [],
      poolCardIds: ["c1"],
    });
    expect(picking).toEqual(["back", "identity:hero-a", "identity:hero-b"]);

    const building = deckBuilderFocusOrder({
      identityChosen: true,
      identityIds: ["hero-a"],
      aspectIds: ["justice", "aggression"],
      typeFilterIds: ["all", "ally", "event", "upgrade", "support", "resource"],
      poolCardIds: ["c1", "c2", "c3"],
    });
    expect(building).toEqual([
      "back",
      "aspect:justice",
      "aspect:aggression",
      "type:all",
      "type:ally",
      "type:event",
      "type:upgrade",
      "type:support",
      "type:resource",
      "name",
      "preconstructed",
      "clear",
      "save",
      "filter-text",
      "card:c1",
      "card:c2",
      "card:c3",
    ]);
  });

  test("Deck check: Back, the three tabs, then only the active tab's own rows, Edit deck, and Start", () => {
    expect(deckCheckFocusOrder({ activeTab: "curve", cardIds: ["c1", "c2"] })).toEqual(["back", "tab:curve", "tab:cards", "tab:aspect", "edit-deck", "start"]);
    expect(deckCheckFocusOrder({ activeTab: "cards", cardIds: ["c1", "c2"] })).toEqual([
      "back",
      "tab:curve",
      "tab:cards",
      "tab:aspect",
      "card:c1",
      "card:c2",
      "edit-deck",
      "start",
    ]);
    expect(deckCheckFocusOrder({ activeTab: "aspect", cardIds: ["c1"] })).toEqual(["back", "tab:curve", "tab:cards", "tab:aspect", "edit-deck", "start"]);
  });

  test("the walkthrough offers Continue first once the phase is over", () => {
    expect(villainPhaseFocusOrder(false)).toEqual(["skip"]);
    expect(villainPhaseFocusOrder(true)).toEqual(["continue", "skip"]);
  });

  test("the inline interrupt window's own controls come right after Continue and before Skip", () => {
    expect(villainPhaseFocusOrder(false, ["a:1"])).toEqual(["interrupt:a:1", "resolve", "skip"]);
    expect(villainPhaseFocusOrder(false, [])).toEqual(["skip"]);
  });

  test("Pause reads close, search, quick reference rows, table rows, then the footer's three buttons", () => {
    expect(pauseFocusOrder({ quickReferenceIds: [], tableRowIds: [], confirmingConcede: false })).toEqual(["close", "search", "save-quit", "concede", "resume"]);
    expect(
      pauseFocusOrder({ quickReferenceIds: ["villainPhase", "glossary"], tableRowIds: ["reduced-motion", "sound"], confirmingConcede: false }),
    ).toEqual(["close", "search", "quick:villainPhase", "quick:glossary", "table:reduced-motion", "table:sound", "save-quit", "concede", "resume"]);
  });

  test("Pause's concede confirm replaces the footer's three buttons with its own two controls", () => {
    const order = pauseFocusOrder({ quickReferenceIds: [], tableRowIds: [], confirmingConcede: true });
    expect(order).not.toContain("resume");
    expect(order).not.toContain("concede");
    expect(order.slice(-2)).toEqual(["concede-confirm-yes", "concede-confirm-cancel"]);
  });

  test("Rules Reference reads Back, tabs, search (glossary only), then rows", () => {
    expect(rulesFocusOrder({ tabIds: ["glossary", "villainPhase", "cardList"], showSearch: true, rowIds: ["guard", "peril"] })).toEqual([
      "back",
      "tab:glossary",
      "tab:villainPhase",
      "tab:cardList",
      "search",
      "row:guard",
      "row:peril",
    ]);
    expect(rulesFocusOrder({ tabIds: ["glossary"], showSearch: false, rowIds: [] })).toEqual(["back", "tab:glossary"]);
  });

  test("Settings reads Back then one stop per row", () => {
    expect(settingsFocusOrder(["reduced-motion", "large-card-text", "sound"])).toEqual(["back", "row:reduced-motion", "row:large-card-text", "row:sound"]);
    expect(settingsFocusOrder([])).toEqual(["back"]);
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

  test("Take your seats: Back, each seat card, use-preconstructed, search, chips, rows (or Clear), then play/deck check", () => {
    expect(seatsFocusOrder({ seatCount: 4, deckIds: ["a", "b"] })).toEqual([
      "back",
      "seat:0",
      "seat:1",
      "seat:2",
      "seat:3",
      "use-preconstructed",
      "hero-search",
      "hero:a",
      "hero:b",
      "play",
      "deck-check",
    ]);
    expect(seatsFocusOrder({ seatCount: 4, deckIds: [] })).toEqual([
      "back",
      "seat:0",
      "seat:1",
      "seat:2",
      "seat:3",
      "use-preconstructed",
      "hero-search",
      "hero-clear",
      "play",
      "deck-check",
    ]);
    expect(seatsFocusOrder({ seatCount: 4, deckIds: ["a"], heroChipIds: ["aspect:justice"] })).toEqual([
      "back",
      "seat:0",
      "seat:1",
      "seat:2",
      "seat:3",
      "use-preconstructed",
      "hero-search",
      "hero-chip:aspect:justice",
      "hero:a",
      "play",
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

  test("Setup deal & mulligan: the deciding seat's own hand, then Mulligan, then Keep all — Keep all is always a stop", () => {
    expect(setupWalkthroughFocusOrder({ optionIds: ["i38", "i40", "i16"] })).toEqual(["option:i38", "option:i40", "option:i16", "confirm", "decline"]);
  });

  test("Setup deal & mulligan: with no options at all, Mulligan and Keep all are still stops", () => {
    expect(setupWalkthroughFocusOrder({ optionIds: [] })).toEqual(["confirm", "decline"]);
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
