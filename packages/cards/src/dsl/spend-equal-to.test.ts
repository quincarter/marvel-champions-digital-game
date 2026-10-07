/**
 * The DSL side of "spend X resources of any type, where X is …" (`AbilityCost.resourcesEqualTo`; Bolstered by Wrath,
 * `next_evol` 40082). The engine's `resources-equal-to-cost.test.ts` drives the behavior.
 */

import { describe, expect, it } from "vitest";
import { heroAction, spendEqualTo } from "./abilities.js";
import { dealDamage } from "./effects.js";
import { validateDefinition } from "./validate.js";
import { accelerationTokensOn, theMainScheme, theVillain, varOf } from "./values.js";

describe("spendEqualTo", () => {
  it("is a resourcesEqualTo cost, and binds cost.resources for the effects", () => {
    const cost = spendEqualTo(accelerationTokensOn(theMainScheme));
    expect(cost).toEqual({ resourcesEqualTo: { kind: "accelerationTokens", on: { kind: "mainScheme" } } });
    expect(validateDefinition(heroAction({ cost }, dealDamage(varOf("cost.resources"), theVillain)))).toEqual([]);
    expect(validateDefinition(heroAction(dealDamage(varOf("cost.resources"), theVillain))).join()).toContain(
      "read before it is bound",
    );
  });
});
