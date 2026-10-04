/**
 * docs/phase7-wave6.md §3.3: "Magneto cannot have more than N[per_hero] sustained damage." `maxSustainedDamage` emits
 * the `RuleSpec maxSustainedDamage` the engine's damage step reads (`max-sustained-damage.test.ts` drives it).
 */

import { describe, expect, it } from "vitest";
import { constant, maxSustainedDamage } from "./abilities.js";
import { validateDefinition } from "./validate.js";
import { inPlay, perHero, query } from "./values.js";

describe("§3.3 `maxSustainedDamage`", () => {
  it("Boarding Party's shape: Magneto cannot have more than 6[per_hero] sustained damage", () => {
    const definition = constant(maxSustainedDamage(query("villain", { name: "Magneto" }), perHero(6)));
    expect(validateDefinition(definition)).toEqual([]);
    expect(definition.trigger).toEqual({
      kind: "constant",
      rules: [
        {
          kind: "maxSustainedDamage",
          target: { categories: ["villain"], name: "Magneto" },
          amount: { kind: "perPlayer", base: 0, perPlayer: 6 },
        },
      ],
    });
  });

  it("a plain number becomes a constant; `while` is carried through", () => {
    const definition = constant(maxSustainedDamage(query("villain"), 12, { while: inPlay("Magneto") }));
    expect(validateDefinition(definition)).toEqual([]);
    expect(definition.trigger).toEqual({
      kind: "constant",
      rules: [
        {
          kind: "maxSustainedDamage",
          target: { categories: ["villain"] },
          amount: { kind: "const", value: 12 },
          while: { kind: "exists", query: { name: "Magneto" } },
        },
      ],
    });
  });
});
