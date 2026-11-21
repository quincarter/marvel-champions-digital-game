import { describe, expect, it } from "vitest";
import type { ChoiceOption } from "@mc/engine";
import { fallbackChoiceView, fallbackPages, toggleFallbackPick } from "./choice-fallback.js";

const option = (optionId: string, label = optionId.toUpperCase()): ChoiceOption =>
  ({ optionId, label, ref: { kind: "none" } }) as unknown as ChoiceOption;
const options = (n: number) => Array.from({ length: n }, (_, i) => option(`o${i}`));

describe("the decision sheet's fallback (#943)", () => {
  it("answers a pick of one on the press, every option listed however many", () => {
    const view = fallbackChoiceView({ options: options(9), minSelections: 1, maxSelections: 1 }, []);
    expect(view.answersOnPress).toBe(true);
    expect(view.rows).toHaveLength(9);
    expect(view.confirm).toBeNull();
    expect(view.canChooseNone).toBe(false);
  });

  it("lets the player pick several and confirms only a legal count", () => {
    const choice = { options: options(4), minSelections: 2, maxSelections: 3 };
    let selected = toggleFallbackPick(choice, [], "o2");
    expect(fallbackChoiceView(choice, selected).confirm).toEqual({ enabled: false, label: "Confirm (1 of 2-3)" });
    selected = toggleFallbackPick(choice, selected, "o0");
    expect(fallbackChoiceView(choice, selected).confirm?.enabled).toBe(true);
    selected = toggleFallbackPick(choice, toggleFallbackPick(choice, selected, "o1"), "o3");
    expect(selected).toEqual(["o2", "o0", "o1"]);
    expect(toggleFallbackPick(choice, selected, "o0")).toEqual(["o2", "o1"]);
  });

  it("offers Choose none only when nothing is required, and the option id for a blank label", () => {
    const view = fallbackChoiceView({ options: [option("a", " ")], minSelections: 0, maxSelections: 1 }, []);
    expect(view.canChooseNone).toBe(true);
    expect(view.rows[0]?.label).toBe("a");
  });

  it("numbers the picks of an ordered decision in the order made, across pages (Codex review)", () => {
    const choice = { options: options(9), minSelections: 3, maxSelections: 3, ordered: true };
    let selected = ["o8", "o0", "o4"] as readonly string[];
    const view = fallbackChoiceView(choice, selected);
    expect(view.ordered).toBe(true);
    expect(view.rows.filter((row) => row.order !== null).map((row) => [row.optionId, row.order])).toEqual([
      ["o0", 2],
      ["o4", 3],
      ["o8", 1],
    ]);
    selected = toggleFallbackPick(choice, selected, "o8");
    expect(fallbackChoiceView(choice, selected).rows.find((row) => row.optionId === "o0")?.order).toBe(1);
    expect(fallbackChoiceView({ ...choice, ordered: false }, selected).rows.every((row) => row.order === null)).toBe(
      true,
    );
  });

  it("pages a list that outruns the room", () => {
    expect(fallbackPages(9, 200, 48)).toEqual({ perPage: 4, pages: 3 });
    expect(fallbackPages(2, 10, 48)).toEqual({ perPage: 1, pages: 2 });
  });
});
