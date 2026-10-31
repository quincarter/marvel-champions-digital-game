import type { ChoiceOption, InstanceId, PendingChoice } from "@mc/engine";
import { describe, expect, test } from "vitest";
import {
  exhaustTileOptionsOf,
  shownSpendChoice,
  spendAnswerOf,
  spendOptionNote,
  spentHandCardOf,
  toggleSpendPick,
} from "./spend-choice.js";

const ABILITY = "50014.organizational-support-interrupt";
const card = (id: string, label = id): ChoiceOption => ({
  optionId: `hand:${id}`,
  label,
  ref: { kind: "card", instanceId: id as InstanceId },
});
const way = (hand: string, set: readonly string[], labels: readonly string[]): ChoiceOption => ({
  optionId: `hand:${hand}:${ABILITY}@exhausted=${set.join(",")}`,
  label: `Organizational Support (${labels.join(", ")})`,
  ref: { kind: "ability", instanceId: hand as InstanceId, abilityId: ABILITY as never },
});
const choiceOf = (options: readonly ChoiceOption[], kind = "spendResources"): PendingChoice =>
  ({ prompt: { kind, requirement: {} }, options, maxSelections: options.length, minSelections: 0 }) as PendingChoice;

const org = choiceOf([
  card("x", "Energy"),
  card("org", "Organizational Support"),
  way("org", ["a"], ["Agent 13"]),
  way("org", ["b"], ["The Iliad"]),
  way("org", ["a", "b"], ["Agent 13", "The Iliad"]),
]);

describe("a payment's ways of spending, as the sheet draws them (issue #569)", () => {
  test("one tile per card to exhaust, right after the hand card", () => {
    const shown = shownSpendChoice(org);
    expect(shown.options.map((option) => option.optionId)).toEqual([
      "hand:x",
      "hand:org",
      "exhaust:org:a",
      "exhaust:org:b",
    ]);
    expect(shown.options[2]).toMatchObject({ label: "Exhaust Agent 13", ref: { kind: "card", instanceId: "a" } });
    expect(shown.maxSelections).toBe(4);
  });

  test("any other prompt, and a payment with nothing to exhaust, is left as it is", () => {
    const other = { ...org, prompt: { kind: "chooseCards", slot: "x" } } as PendingChoice;
    expect(shownSpendChoice(other)).toBe(other);
    const plain = choiceOf([card("x")]);
    expect(shownSpendChoice(plain)).toBe(plain);
    const siphon = choiceOf([
      card("s"),
      { ...card("s"), optionId: `hand:s:siphon@#damageSelf=2`, label: "Energy Siphon (take 2 damage)" },
    ]);
    expect(shownSpendChoice(siphon)).toBe(siphon);
  });

  test("a second copy exhausts what the first can't, each with its own way", () => {
    const limited = choiceOf([
      card("org"),
      way("org", ["a"], ["A"]),
      way("org", ["b"], ["B"]),
      card("org2"),
      way("org2", ["a"], ["A"]),
      way("org2", ["b"], ["B"]),
    ]);
    const picks = toggleSpendPick(limited, toggleSpendPick(limited, [], "exhaust:org:a"), "exhaust:org:b");
    expect(picks).toContain("hand:org2");
    expect([...spendAnswerOf(limited, picks)].sort()).toEqual(
      [way("org", ["a"], []).optionId, way("org2", ["b"], []).optionId].sort(),
    );
  });

  test("a second copy keeps its plain option and draws no tiles", () => {
    const two = choiceOf([...org.options, card("org2", "Organizational Support"), way("org2", ["a"], ["Agent 13"])]);
    expect(shownSpendChoice(two).options.map((option) => option.optionId)).toEqual([
      "hand:x",
      "hand:org",
      "exhaust:org:a",
      "exhaust:org:b",
      "hand:org2",
    ]);
  });

  test("a card to exhaust brings its hand card, and the answer is the engine's own way", () => {
    const one = toggleSpendPick(org, ["hand:x"], "exhaust:org:b");
    expect(one).toEqual(["hand:x", "hand:org", "exhaust:org:b"]);
    expect(spendAnswerOf(org, one)).toEqual(["hand:x", way("org", ["b"], []).optionId]);
    const both = toggleSpendPick(org, one, "exhaust:org:a");
    expect(spendAnswerOf(org, both)).toEqual(["hand:x", way("org", ["a", "b"], []).optionId]);
  });

  test("taking a card out keeps the hand card; taking the hand card out takes its cards too", () => {
    const both = toggleSpendPick(org, toggleSpendPick(org, [], "exhaust:org:a"), "exhaust:org:b");
    expect(toggleSpendPick(org, both, "exhaust:org:a")).toEqual(["hand:org", "exhaust:org:b"]);
    expect(toggleSpendPick(org, both, "hand:org")).toEqual([]);
  });

  test("a card past the most any set allows changes nothing", () => {
    const limited = choiceOf([card("org"), way("org", ["a"], ["A"]), way("org", ["b"], ["B"])]);
    const one = toggleSpendPick(limited, [], "exhaust:org:a");
    expect(toggleSpendPick(limited, one, "exhaust:org:b")).toBe(one);
  });

  test("a second way of spending a hand card replaces the first", () => {
    const amounts = choiceOf([card("s"), { ...card("s"), optionId: "hand:s:siphon@#damageSelf=1" }]);
    const first = toggleSpendPick(amounts, ["hand:s"], "hand:s:siphon@#damageSelf=1");
    expect(first).toEqual(["hand:s:siphon@#damageSelf=1"]);
    expect(toggleSpendPick(amounts, first, "hand:s")).toEqual(["hand:s"]);
  });

  test("the small readers", () => {
    expect(spentHandCardOf("hand:a:b@c=d")).toBe("a");
    expect(spentHandCardOf("ability:a:b")).toBeNull();
    expect(spendOptionNote("Energy Siphon (take 2 damage)")).toBe("take 2 damage");
    expect(spendOptionNote("Energy")).toBeNull();
    expect(exhaustTileOptionsOf(org, "exhaust:org:a")).toEqual({
      alone: way("org", ["a"], []).optionId,
      plain: "hand:org",
    });
    expect(exhaustTileOptionsOf(org, "hand:x")).toBeNull();
  });
});
