/**
 * The DSL side of "spend up to 3 resources →" (`AbilityCost.resources { choose }`; Husk, `jubilee` 47012;
 * docs/phase7-wave8.md §3.62). The engine's `chosen-resource-cost.test.ts` drives the behavior.
 */

import type { AbilityCost } from "@mc/engine";
import { describe, expect, it } from "vitest";
import { heroAction, spendChosen, spendEqualTo, spendUpTo } from "./abilities.js";
import { dealDamage } from "./effects.js";
import { validateDefinition } from "./validate.js";
import { theVillain, varOf } from "./values.js";

const one = { kind: "const", value: 1 } as const;
const problems = (cost: AbilityCost) =>
  validateDefinition(heroAction({ cost }, dealDamage(one, theVillain))).join("; ");

describe("spendChosen", () => {
  it("is a chosen-size resource cost of 1 to max by default, and binds cost.resources for the effects", () => {
    expect(spendChosen(3)).toEqual({ resources: { choose: { min: 1, max: 3 } } });
    expect(spendChosen(3, 2)).toEqual({ resources: { choose: { min: 2, max: 3 } } });
    expect(
      validateDefinition(heroAction({ cost: spendChosen(3) }, dealDamage(varOf("cost.resources"), theVillain))),
    ).toEqual([]);
    expect(validateDefinition(heroAction(dealDamage(varOf("cost.resources"), theVillain))).join()).toContain(
      "read before it is bound",
    );
  });

  it('needs at least one resource (RRG 1.8 "Cost", p. 14) and a max no smaller than min', () => {
    expect(problems(spendChosen(3, 0))).toContain("min must be a whole number of at least 1");
    expect(problems(spendChosen(3, 1.5))).toContain("min must be a whole number of at least 1");
    expect(problems(spendChosen(1, 2))).toContain("max must be a whole number no smaller than min");
    expect(problems(spendChosen(2.5))).toContain("max must be a whole number no smaller than min");
    expect(problems(spendChosen(1))).toBe("");
  });

  it("is not combined with another size of the same payment", () => {
    expect(problems({ ...spendChosen(3), ...spendUpTo(2) })).toContain("not with resourcesX");
    expect(problems({ ...spendChosen(3), ...spendEqualTo(one) })).toContain("not with resourcesEqualTo");
    expect(problems({ ...spendChosen(3), sameResourceType: true })).toContain("sameResourceType");
  });
});
