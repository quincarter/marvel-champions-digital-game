import { describe, expect, test } from "vitest";
import { stepKey } from "./focus.js";
import { deckBuilderFocusOrder, decksFocusOrder, titleFocusOrder, villainPhaseFocusOrder } from "./screen-focus.js";

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

  test("Breakout's villain-version stops sit between difficulty and the hero search", () => {
    const input = {
      continuable: false,
      scenarioIds: ["breakout"],
      difficulties: ["standard", "expert", "extreme"],
      villainVersionIds: ["wrecker", "thunderball"],
      deckIds: ["a"],
    };
    const order = titleFocusOrder(input);
    expect(order.indexOf("difficulty:extreme")).toBeLessThan(order.indexOf("villain-version:wrecker"));
    expect(order.indexOf("villain-version:thunderball")).toBeLessThan(order.indexOf("hero-search"));
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
