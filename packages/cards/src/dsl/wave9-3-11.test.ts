/**
 * docs/phase7-wave9.md §3.11: `chooseCards(..., { maxTotalPrintedCost })`, "any number of S.H.I.E.L.D. supports with
 * a combined printed cost of 6 or less". The engine's `choose-cards-max-total.test.ts` drives the plain data.
 */

import { trait } from "@mc/content";
import { describe, expect, it } from "vitest";
import { action } from "./abilities.js";
import { ANY_NUMBER, cards, chooseCards } from "./effects.js";
import { validateDefinition } from "./validate.js";
import { query } from "./values.js";

const supports = cards({ kind: "each", query: query("support", { trait: trait("S.H.I.E.L.D.") }) });

describe("§3.11 `chooseCards` with `maxTotalPrintedCost`", () => {
  it("emits `maxTotal` over printed cost, and nothing without the option", () => {
    expect(chooseCards("picked", supports, { min: 0, max: ANY_NUMBER, maxTotalPrintedCost: 6 })).toEqual({
      kind: "chooseCards",
      slot: "picked",
      from: supports,
      chooser: { kind: "controller" },
      min: 0,
      max: 99,
      maxTotal: { of: "printedCost", atMost: 6 },
    });
    expect(chooseCards("picked", supports, { min: 0, max: 1 })).not.toHaveProperty("maxTotal");
    // A limit of 0 is a limit ("with a combined printed cost of 0"), not the absence of one.
    expect(chooseCards("picked", supports, { min: 0, max: 1, maxTotalPrintedCost: 0 })).toMatchObject({
      maxTotal: { atMost: 0 },
    });
  });

  it("validates: the limit is a whole number of at least 0", () => {
    const problems = (limit: number) =>
      validateDefinition(
        action({}, chooseCards("picked", supports, { min: 0, max: ANY_NUMBER, maxTotalPrintedCost: limit })),
      ).join("\n");
    expect(problems(6)).toBe("");
    expect(problems(0)).toBe("");
    expect(problems(-1)).toMatch(/maxTotal: atMost must be a whole number of at least 0/);
    expect(problems(2.5)).toMatch(/maxTotal: atMost must be a whole number of at least 0/);
  });
});
