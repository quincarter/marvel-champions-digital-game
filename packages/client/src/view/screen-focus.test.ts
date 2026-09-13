import { describe, expect, test } from "vitest";
import { stepKey } from "./focus.js";
import { deckBuilderFocusOrder, decksFocusOrder, titleFocusOrder, villainPhaseFocusOrder } from "./screen-focus.js";

describe("screen focus routes", () => {
  test("the Title screen reads top to bottom, with Continue first only when there is a game to continue", () => {
    const input = { continuable: false, scenarioIds: ["rhino", "klaw"], difficulties: ["standard", "expert"], deckIds: ["a", "b"] };
    expect(titleFocusOrder(input)).toEqual([
      "scenario:rhino",
      "scenario:klaw",
      "difficulty:standard",
      "difficulty:expert",
      "hero:a",
      "hero:b",
      "seed",
      "new-seed",
      "start",
    ]);
    expect(titleFocusOrder({ ...input, continuable: true })[0]).toBe("continue");
  });

  test("Title gains a Manage decks stop, after the hero seats, only when it's shown", () => {
    const input = { continuable: false, scenarioIds: ["rhino"], difficulties: ["standard"], deckIds: ["a", "b"] };
    expect(titleFocusOrder(input)).not.toContain("manage-decks");
    expect(titleFocusOrder({ ...input, manageDecks: true })).toEqual([
      "scenario:rhino",
      "difficulty:standard",
      "hero:a",
      "hero:b",
      "manage-decks",
      "seed",
      "new-seed",
      "start",
    ]);
  });

  test("the Decks screen only gives a stop to the deck list's visible rows, plus scroll steppers when there is more", () => {
    const base = {
      showMarvelCdbImport: false,
      visibleDeckIds: ["p1", "s1"],
      editableDeckIds: new Set(["s1"]),
      canScrollUp: false,
      canScrollDown: false,
    };
    expect(decksFocusOrder(base)).toEqual(["back", "paste-field", "paste-import", "new-deck", "deck:p1", "deck:s1", "deck:s1:edit", "deck:s1:delete"]);
    expect(decksFocusOrder({ ...base, showMarvelCdbImport: true })).toContain("marvelcdb-field");
    expect(decksFocusOrder({ ...base, showMarvelCdbImport: true })).toContain("marvelcdb-import");
    const scrolled = decksFocusOrder({ ...base, canScrollUp: true, canScrollDown: true });
    expect(scrolled[4]).toBe("scroll-up");
    expect(scrolled.at(-1)).toBe("scroll-down");
  });

  test("the deck builder shows only the identity picker until one is chosen, then the rest", () => {
    const picking = deckBuilderFocusOrder({
      identityChosen: false,
      identityIds: ["hero-a", "hero-b"],
      aspectIds: ["justice"],
      visiblePoolCardIds: ["c1"],
      canScrollUp: false,
      canScrollDown: false,
    });
    expect(picking).toEqual(["back", "identity:hero-a", "identity:hero-b"]);

    const building = deckBuilderFocusOrder({
      identityChosen: true,
      identityIds: ["hero-a"],
      aspectIds: ["justice", "aggression"],
      visiblePoolCardIds: ["c1", "c2"],
      canScrollUp: false,
      canScrollDown: false,
    });
    expect(building).toEqual(["back", "aspect:justice", "aspect:aggression", "name", "filter-text", "card:c1", "card:c2", "save"]);
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
