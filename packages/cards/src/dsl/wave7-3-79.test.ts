/**
 * docs/phase7-wave7.md §3.79: the DSL side of a damage cost whose amount the payer chooses (Maximum Effort 44004,
 * "Yoo-Hoo!" 44006). The engine's `damage-self-choice-cost.test.ts` drives the behavior.
 */

import { describe, expect, it } from "vitest";
import { heroAction, takeAnyDamageCost } from "./abilities.js";
import { dealDamage, removeThreat } from "./effects.js";
import { validateDefinition } from "./validate.js";
import { remainingHpOf, theMainScheme, theVillain, varOf, yourIdentity } from "./values.js";

describe("§3.79 takeAnyDamageCost", () => {
  it("is a chosen damageSelf cost from 0 (Q46 = B) to the given maximum", () => {
    expect(takeAnyDamageCost(remainingHpOf(yourIdentity))).toEqual({
      damageSelf: {
        choose: {
          min: { kind: "const", value: 0 },
          max: { kind: "remainingHp", of: { kind: "identityOf", player: { kind: "controller" } } },
        },
      },
    });
  });

  it("takes a minimum and plain numbers", () => {
    expect(takeAnyDamageCost(4, { min: 2 })).toEqual({
      damageSelf: { choose: { min: { kind: "const", value: 2 }, max: { kind: "const", value: 4 } } },
    });
  });

  it("the pick is read after the arrow as cost.damageSelf, by an attack and by a thwart", () => {
    const cost = takeAnyDamageCost(remainingHpOf(yourIdentity));
    const attack = heroAction({ cost }, dealDamage(varOf("cost.damageSelf"), theVillain));
    const thwart = heroAction({ cost }, removeThreat(varOf("cost.damageSelf"), theMainScheme));
    expect(attack.cost).toEqual(cost);
    expect(validateDefinition(attack)).toEqual([]);
    expect(validateDefinition(thwart)).toEqual([]);
    // Without the cost, nothing binds the var.
    expect(validateDefinition(heroAction(dealDamage(varOf("cost.damageSelf"), theVillain))).join()).toContain(
      "read before it is bound",
    );
  });
});
