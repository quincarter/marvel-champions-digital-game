/**
 * `gainsAbility`: "… this card gains: 'Response: After you play an Aerial card, exhaust this card → ready an ally you
 * control.'" (Flight Squadron, `falcon` 53020) as a constant's rule naming a registry-only ability. The engine's
 * `gains-ability.test.ts` drives the plain data.
 */

import { trait } from "@mc/content";
import { describe, expect, it } from "vitest";
import { constant, gainsAbility, rule } from "./abilities.js";
import { validateDefinition } from "./validate.js";
import { exists, not, query } from "./values.js";

const AERIAL = trait("AERIAL");
const EACH_ALLY_AERIAL = not(exists(query("ally", { controller: "you", withoutTrait: AERIAL })));

describe("`gainsAbility`", () => {
  it("is a rule naming the granted ability, for this card unless `to` names others, with an optional `while`", () => {
    expect(constant(gainsAbility("x.granted-response")).trigger).toEqual({
      kind: "constant",
      rules: [{ kind: "gainsAbility", abilityId: "x.granted-response" }],
    });
    const each = constant(gainsAbility("x.granted-action", { to: query("ally", { controller: "you" }) }));
    expect(each.trigger).toMatchObject({
      rules: [{ kind: "gainsAbility", abilityId: "x.granted-action", to: { categories: ["ally"], controller: "you" } }],
    });
    expect(validateDefinition(each)).toEqual([]);
  });

  it("sits beside the constant's other parts under one condition (Flight Squadron's shape)", () => {
    const definition = constant(
      rule({ kind: "allyLimit", amount: 1, while: EACH_ALLY_AERIAL }),
      gainsAbility("x.granted-response", { while: EACH_ALLY_AERIAL }),
    );
    expect(definition.trigger).toMatchObject({
      kind: "constant",
      rules: [
        { kind: "allyLimit", amount: 1, while: EACH_ALLY_AERIAL },
        { kind: "gainsAbility", abilityId: "x.granted-response", while: EACH_ALLY_AERIAL },
      ],
    });
    expect(validateDefinition(definition)).toEqual([]);
  });
});
