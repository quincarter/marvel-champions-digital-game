import { describe, expect, test } from "vitest";
import { overBuildBudget } from "./build-budget.js";

describe("overBuildBudget (issue #722)", () => {
  test("no budget: never stops", () => {
    expect(overBuildBudget(undefined, 10, 1000)).toBe(false);
  });

  test("always draws one row first, even with a budget of 0", () => {
    expect(overBuildBudget(0, 0, 50)).toBe(false);
    expect(overBuildBudget(0, 1, 0.1)).toBe(true);
  });

  test("stops once the budget is spent", () => {
    expect(overBuildBudget(8, 2, 7.9)).toBe(false);
    expect(overBuildBudget(8, 2, 8.1)).toBe(true);
  });
});
