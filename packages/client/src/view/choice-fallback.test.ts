import { describe, expect, it } from "vitest";
import type { ChoiceOption } from "@mc/engine";
import { FALLBACK_OPTION_LIMIT, fallbackChoiceButtons } from "./choice-fallback.js";

const option = (optionId: string, label = optionId.toUpperCase()): ChoiceOption =>
  ({ optionId, label, ref: { kind: "none" } }) as unknown as ChoiceOption;

describe("fallbackChoiceButtons (#943)", () => {
  it("offers each option of a pick of one", () => {
    const buttons = fallbackChoiceButtons({ options: [option("a"), option("b")], minSelections: 1, maxSelections: 1 });
    expect(buttons).toEqual([
      { label: "A", answer: ["a"] },
      { label: "B", answer: ["b"] },
    ]);
  });

  it("adds Choose none when nothing is required", () => {
    const buttons = fallbackChoiceButtons({ options: [option("a")], minSelections: 0, maxSelections: 1 });
    expect(buttons.map((button) => button.label)).toEqual(["A", "Choose none"]);
    expect(buttons[1]?.answer).toEqual([]);
  });

  it("lets the game pick the first required options of a larger decision", () => {
    const options = ["a", "b", "c"].map((id) => option(id));
    expect(fallbackChoiceButtons({ options, minSelections: 2, maxSelections: 3 })).toEqual([
      { label: "Let the game pick", answer: ["a", "b"] },
    ]);
    const many = Array.from({ length: FALLBACK_OPTION_LIMIT + 1 }, (_, i) => option(`o${i}`));
    expect(fallbackChoiceButtons({ options: many, minSelections: 1, maxSelections: 1 })).toEqual([
      { label: "Let the game pick", answer: ["o0"] },
    ]);
  });

  it("falls back to the option id for a blank label", () => {
    const buttons = fallbackChoiceButtons({ options: [option("a", " ")], minSelections: 1, maxSelections: 1 });
    expect(buttons[0]?.label).toBe("a");
  });
});
