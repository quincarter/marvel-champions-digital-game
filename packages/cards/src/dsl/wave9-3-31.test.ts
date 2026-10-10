/**
 * docs/phase7-wave9.md §3.31: `additionalPowerCost`, "As an additional cost for a player to attack, thwart, or defend
 * with an ally, that player must spend 1 resource of any type" (Divided Loyalties, `aos` 50173). The engine's
 * `additional-power-cost.test.ts` drives the plain data.
 */

import { describe, expect, it } from "vitest";
import { additionalPowerCost, constant } from "./abilities.js";
import { validateDefinition } from "./validate.js";
import { inForm, query } from "./values.js";

describe("§3.31 `additionalPowerCost`", () => {
  it("builds Divided Loyalties: a constant rule over every ally's attack, thwart and defense", () => {
    const definition = constant(additionalPowerCost(query("ally"), ["attack", "thwart", "defend"], 1));
    expect(definition.trigger).toEqual({
      kind: "constant",
      rules: [
        {
          kind: "additionalPowerCost",
          character: { categories: ["ally"] },
          powers: ["attack", "thwart", "defend"],
          resources: 1,
        },
      ],
    });
    expect(validateDefinition(definition)).toEqual([]);
  });

  it("takes a typed cost, a narrower set of powers and a condition", () => {
    const whileHero = inForm("hero");
    const definition = constant(
      additionalPowerCost(query("ally", { controller: "you" }), ["attack"], { energy: 1 }, { while: whileHero }),
    );
    expect(definition.trigger).toEqual({
      kind: "constant",
      rules: [
        {
          kind: "additionalPowerCost",
          character: { categories: ["ally"], controller: "you" },
          powers: ["attack"],
          resources: { energy: 1 },
          while: whileHero,
        },
      ],
    });
    expect(validateDefinition(definition)).toEqual([]);
  });
});
