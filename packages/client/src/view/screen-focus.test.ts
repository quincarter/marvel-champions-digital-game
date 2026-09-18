import { describe, expect, test } from "vitest";
import { stepKey } from "./focus.js";
import {
  deckBuilderFocusOrder,
  deckCheckFocusOrder,
  decksFocusOrder,
  pauseFocusOrder,
  rulesFocusOrder,
  settingsFocusOrder,
  titleFocusOrder,
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

  test("the Decks screen gives every deck row a stop, not just the ones currently on screen — every row also gets Check", () => {
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
      "deck:p1:check",
      "deck:s1",
      "deck:s1:check",
      "deck:s1:edit",
      "deck:s1:delete",
      "deck:s2",
      "deck:s2:check",
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

  test("Pause reads Resume, Save & quit, Rules, Settings, then moments, then Concede last", () => {
    expect(pauseFocusOrder({ momentIds: [], confirmingConcede: false })).toEqual(["resume", "save-quit", "rules", "settings", "concede"]);
    expect(pauseFocusOrder({ momentIds: ["m1", "m2"], confirmingConcede: false })).toEqual([
      "resume",
      "save-quit",
      "rules",
      "settings",
      "moment:m1",
      "moment:m2",
      "concede",
    ]);
  });

  test("Pause's concede confirm replaces the single Concede stop with its own two controls", () => {
    const order = pauseFocusOrder({ momentIds: [], confirmingConcede: true });
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
