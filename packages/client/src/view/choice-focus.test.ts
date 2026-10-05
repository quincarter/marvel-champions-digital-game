import { describe, expect, test } from "vitest";
import type { PendingChoice } from "@mc/engine";
import {
  canConfirmChoice,
  cardChoiceDisplayOrder,
  choiceFocusKey,
  choiceFocusOrder,
  initialChoiceSelection,
  sameChoiceTarget,
} from "./choice-focus.js";
import { stepFocus } from "./focus.js";

const options = ["a", "b", "c", "d"].map((optionId) => ({
  optionId,
  label: optionId,
  ref: { kind: "none" },
})) as unknown as PendingChoice["options"];

describe("choice sheet Confirm", () => {
  const one = options.slice(0, 1);

  test("a lone option starts selected, so Confirm means 'yes, this one'", () => {
    expect(initialChoiceSelection({ options: one, maxSelections: 1 })).toEqual(["a"]);
    expect(initialChoiceSelection({ options, maxSelections: 1 })).toEqual([]);
    expect(initialChoiceSelection({ options: one, maxSelections: 0 })).toEqual([]);
  });

  test("a discard never starts with an optional card picked; only a forced, choiceless amount does", () => {
    const discard = { kind: "discardDownToHandSize", handSize: 4 } as const;
    // One card in hand, hand size 4: nothing is owed, so the lone card is not preselected.
    expect(initialChoiceSelection({ options: one, minSelections: 0, maxSelections: 1, prompt: discard })).toEqual([]);
    // Four cards, one owed: a choice among them, nothing preselected.
    expect(initialChoiceSelection({ options, minSelections: 1, maxSelections: 4, prompt: discard })).toEqual([]);
    // Every card must go: no choice at all, so the whole hand starts picked.
    expect(initialChoiceSelection({ options: one, minSelections: 1, maxSelections: 1, prompt: discard })).toEqual([
      "a",
    ]);
    // Paying is optional as well.
    const pay = { kind: "payForAbility", instanceId: "i", abilityId: "a", cost: 1 } as never;
    expect(initialChoiceSelection({ options: one, minSelections: 0, maxSelections: 1, prompt: pay })).toEqual([]);
  });

  test("with Decline on the sheet, Confirm needs a pick — it is never a second Decline", () => {
    expect(canConfirmChoice({ options: one, minSelections: 0, maxSelections: 1 }, 0)).toBe(false);
    expect(canConfirmChoice({ options: one, minSelections: 0, maxSelections: 1 }, 1)).toBe(true);
    expect(canConfirmChoice({ options, minSelections: 2, maxSelections: 3 }, 1)).toBe(false);
    expect(canConfirmChoice({ options, minSelections: 2, maxSelections: 3 }, 2)).toBe(true);
  });
});

describe("choice sheet focus", () => {
  test("a card choice is walked in the order it is drawn: picks first, in pick order, then the stack", () => {
    expect(cardChoiceDisplayOrder(options, [])).toEqual(["a", "b", "c", "d"]);
    expect(cardChoiceDisplayOrder(options, ["c", "a"])).toEqual(["c", "a", "b", "d"]);
  });

  test("a stale pick the engine no longer offers is not a stop", () => {
    expect(cardChoiceDisplayOrder(options, ["gone", "b"])).toEqual(["b", "a", "c", "d"]);
  });

  test("the options, then Confirm, then Decline only when declining is legal", () => {
    expect(choiceFocusOrder(["a", "b"], false).map(choiceFocusKey)).toEqual(["option:a", "option:b", "confirm"]);
    expect(choiceFocusOrder(["a"], true).map(choiceFocusKey)).toEqual(["option:a", "confirm", "decline"]);
  });

  test("focus on a card survives it moving between rows", () => {
    const before = choiceFocusOrder(cardChoiceDisplayOrder(options, []), false);
    const focused = before[2]!; // "c"
    const after = choiceFocusOrder(cardChoiceDisplayOrder(options, ["c"]), false);
    // Picking "c" lifts it to the front, but the ring stays on "c".
    expect(after.findIndex((target) => sameChoiceTarget(target, focused))).toBe(0);
  });

  test("the guide strip's own targets (§3.10, §7 accessibility fix) key and compare like every other target", () => {
    expect(choiceFocusKey({ kind: "guideSkip" })).toBe("guideSkip");
    expect(choiceFocusKey({ kind: "guideStop" })).toBe("guideStop");
    expect(choiceFocusKey({ kind: "guidePrimary" })).toBe("guidePrimary");
    expect(sameChoiceTarget({ kind: "guideSkip" }, { kind: "guideSkip" })).toBe(true);
    expect(sameChoiceTarget({ kind: "guideSkip" }, { kind: "guideStop" })).toBe(false);
    expect(sameChoiceTarget({ kind: "guideSkip" }, { kind: "confirm" })).toBe(false);
  });

  test("the route wraps both ways, shared with the board's stepper", () => {
    const route = choiceFocusOrder(["a", "b"], true);
    expect(stepFocus(route, route.length - 1, 1)).toBe(0);
    expect(stepFocus(route, 0, -1)).toBe(route.length - 1);
    expect(stepFocus(route, -1, 1)).toBe(0);
  });
});
