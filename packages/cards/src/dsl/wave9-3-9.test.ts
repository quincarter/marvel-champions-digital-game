/**
 * docs/phase7-wave9.md §3.9: `enemyScheme(..., { divert })`, "place 1 threat from that activation here instead of on
 * the main scheme if …". The engine's `scheme-threat-divert.test.ts` drives the plain data these builders emit.
 */

import { describe, expect, it } from "vitest";
import { forcedInterrupt, on } from "./abilities.js";
import { enemyScheme } from "./effects.js";
import { validateDefinition } from "./validate.js";
import { self, theMainScheme, theVillain, threatOn, valueAtMost } from "./values.js";

describe("§3.9 `enemyScheme` with `divert`", () => {
  it("emits the card, the condition and an amount of 1 unless one is given", () => {
    const fits = valueAtMost(threatOn(self), 5);
    expect(enemyScheme(theVillain, { divert: { to: self, if: fits } })).toEqual({
      kind: "enemyScheme",
      enemies: theVillain,
      divert: { amount: 1, to: self, if: fits },
    });
    expect(enemyScheme(theVillain, { divert: { to: self, amount: 2 } })).toEqual({
      kind: "enemyScheme",
      enemies: theVillain,
      divert: { amount: 2, to: self },
    });
    expect(enemyScheme(theVillain)).toEqual({ kind: "enemyScheme", enemies: theVillain });
  });

  it("validates: a whole amount of at least 1, and a card other than the main scheme", () => {
    const withDivert = (divert: Parameters<typeof enemyScheme>[1] & object) =>
      validateDefinition(
        forcedInterrupt(on.enemyAttacks({ categories: ["enemy"] }), {}, enemyScheme(theVillain, divert)),
      ).join("\n");
    expect(withDivert({ divert: { to: self } })).toBe("");
    expect(withDivert({ divert: { to: self, amount: 0 } })).toMatch(/divert: a constant amount must be a whole number/);
    expect(withDivert({ divert: { to: self, amount: 1.5 } })).toMatch(/divert: a constant amount must be a whole/);
    expect(withDivert({ divert: { to: theMainScheme } })).toMatch(/diverted from the main scheme/);
  });
});
