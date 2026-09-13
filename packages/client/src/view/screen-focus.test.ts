import { describe, expect, test } from "vitest";
import { stepKey } from "./focus.js";
import { titleFocusOrder, villainPhaseFocusOrder } from "./screen-focus.js";

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
