/**
 * docs/phase7-wave7.md §3.47: `printedCostAtLeast(n)`, "with a printed cost of N or more", as a query part and as the
 * `appliesTo` of "Reduce the cost to play each event with a printed cost of 3 or more by 1". The engine's
 * `min-printed-cost.test.ts` drives the clause and the reduction.
 */

import { describe, expect, it } from "vitest";
import { constant, costModifier } from "./abilities.js";
import { validateDefinition } from "./validate.js";
import { countersOn, printedCostAtLeast, query, self } from "./values.js";

describe("§3.47 a printed cost of N or more", () => {
  it("printedCostAtLeast(3) is the minPrintedCost clause, spread into a query", () => {
    expect(printedCostAtLeast(3)).toEqual({ minPrintedCost: 3 });
    expect(query("event", printedCostAtLeast(3))).toEqual({ categories: ["event"], minPrintedCost: 3 });
    // A value bound, and a band with the upper bound written beside it.
    expect(printedCostAtLeast(countersOn(self, "time"))).toEqual({
      minPrintedCost: { kind: "counters", of: { kind: "self" }, counterType: "time" },
    });
    expect(query("ally", { ...printedCostAtLeast(2), maxPrintedCost: 3 })).toEqual({
      categories: ["ally"],
      minPrintedCost: 2,
      maxPrintedCost: 3,
    });
  });

  it("'reduce the cost to play each event with a printed cost of 3 or more by 1' is a constant cost modifier", () => {
    const definition = constant(costModifier({ delta: -1, appliesTo: query("event", printedCostAtLeast(3)) }));
    expect(definition.trigger).toEqual({
      kind: "constant",
      costModifiers: [{ delta: -1, appliesTo: { categories: ["event"], minPrintedCost: 3 } }],
    });
    expect(validateDefinition(definition)).toEqual([]);
  });
});
