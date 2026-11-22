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

  test("the copy the player already spends exhausts, not the other one", () => {
    const two = choiceOf([card("org"), way("org", ["a"], ["A"]), card("org2"), way("org2", ["a"], ["A"])]);
    const picks = toggleSpendPick(two, ["hand:org2"], "exhaust:org:a");
    expect(picks).not.toContain("hand:org");
    expect(spendAnswerOf(two, picks)).toEqual([way("org2", ["a"], []).optionId]);
  });

  test("a card only one copy's owner can exhaust goes to that copy (an alliance helper's)", () => {
    const helper = choiceOf([card("mine"), way("mine", ["a"], ["A"]), card("theirs"), way("theirs", ["b"], ["B"])]);
    const shown = shownSpendChoice(helper);
    expect(shown.options.map((option) => option.optionId)).toContain("exhaust:mine:b");
    const picks = toggleSpendPick(helper, [], "exhaust:mine:b");
    expect(picks).toContain("hand:theirs");
    expect(picks).not.toContain("hand:mine");
    expect(spendAnswerOf(helper, picks)).toEqual([way("theirs", ["b"], []).optionId]);
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

  describe("a resource ability exhausting any number of cards (issue #966)", () => {
    const base = "ability:ecs:interrupt";
    // `many`: the engine's `picksMany`, set on every option of a cost that picks a set of cards.
    const sub = (set: readonly string[], labels: readonly string[], many = true): ChoiceOption => ({
      optionId: `${base}@exhausted=${set.join(",")}`,
      label: `Enhanced Combat Sense (${labels.join(", ")})`,
      ref: { kind: "ability", instanceId: "ecs" as InstanceId, abilityId: "interrupt" as never },
      ...(many ? { picksMany: true as const } : {}),
    });
    const ecs = choiceOf(
      [card("x", "Energy"), sub(["a"], ["EMP"]), sub(["b"], ["Armor"]), sub(["a", "b"], ["EMP", "Armor"])],
      "payForCard",
    );

    test("one tile per upgrade, where the first subset stood", () => {
      const shown = shownSpendChoice(ecs);
      expect(shown.options.map((option) => option.optionId)).toEqual(["hand:x", `pick:a@${base}`, `pick:b@${base}`]);
      expect(shown.options[1]).toMatchObject({ label: "Exhaust EMP", ref: { kind: "card", instanceId: "a" } });
    });

    test("tapping builds the set, and the answer is the one option for it", () => {
      const one = toggleSpendPick(ecs, ["hand:x"], `pick:a@${base}`);
      expect(spendAnswerOf(ecs, one)).toEqual(["hand:x", sub(["a"], []).optionId]);
      const both = toggleSpendPick(ecs, one, `pick:b@${base}`);
      expect(spendAnswerOf(ecs, both)).toEqual(["hand:x", sub(["a", "b"], []).optionId]);
      const back = toggleSpendPick(ecs, both, `pick:a@${base}`);
      expect(spendAnswerOf(ecs, back)).toEqual(["hand:x", sub(["b"], []).optionId]);
      expect(spendAnswerOf(ecs, toggleSpendPick(ecs, back, `pick:b@${base}`))).toEqual(["hand:x"]);
    });

    test("a set no option covers changes nothing", () => {
      const limited = choiceOf([sub(["a"], ["EMP"]), sub(["b"], ["Armor"]), sub(["c"], ["Gun"]), sub(["a", "b"], [])]);
      const picks = toggleSpendPick(limited, toggleSpendPick(limited, [], `pick:a@${base}`), `pick:b@${base}`);
      expect(toggleSpendPick(limited, picks, `pick:c@${base}`)).toBe(picks);
    });

    test("a fixed-set cost with no one-card option, and a single pick, keep their option tiles", () => {
      const fixed = choiceOf(
        [sub(["a", "b"], ["EMP", "Armor"], false), sub(["a", "c"], ["EMP", "Gun"], false)],
        "payForCard",
      );
      expect(shownSpendChoice(fixed)).toBe(fixed);
      const single = choiceOf([sub(["a"], ["A"], false), sub(["b"], ["B"], false)], "payForCard");
      expect(shownSpendChoice(single)).toBe(single);
    });

    test("one upgrade to exhaust is still its own tile, showing that upgrade", () => {
      const lone = choiceOf([card("x", "Energy"), sub(["a"], ["EMP"])], "payForCard");
      expect(shownSpendChoice(lone).options.map((option) => option.optionId)).toEqual(["hand:x", `pick:a@${base}`]);
      expect(spendAnswerOf(lone, toggleSpendPick(lone, [], `pick:a@${base}`))).toEqual([sub(["a"], []).optionId]);
    });

    test("past what the engine lists, a tap lands on the nearest set it offers (seven upgrades and more)", () => {
      // Offered: each card alone, a+b, and a+b+c; b+c is not.
      const capped = choiceOf([
        sub(["a"], []),
        sub(["b"], []),
        sub(["c"], []),
        sub(["a", "b"], []),
        sub(["a", "b", "c"], []),
      ]);
      const all = [`pick:a@${base}`, `pick:b@${base}`, `pick:c@${base}`];
      // Taking a out of a+b+c leaves b+c, which is not offered: the largest offered set inside it, one card.
      const out = toggleSpendPick(capped, all, `pick:a@${base}`);
      expect(out).toHaveLength(1);
      expect(spendAnswerOf(capped, out)).toHaveLength(1);
      // Adding c to b reaches no b+c either: the smallest offered set holding both, a+b+c.
      const grown = toggleSpendPick(capped, [`pick:b@${base}`], `pick:c@${base}`);
      expect([...grown].sort()).toEqual([...all].sort());
    });

    test("a caption reads the card alone, with no plain spending", () => {
      expect(exhaustTileOptionsOf(ecs, `pick:b@${base}`)).toEqual({ alone: sub(["b"], []).optionId, plain: null });
    });
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
