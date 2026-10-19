/**
 * Wave 11 hero packs: `changeFormCost(to)`, "change to hero form and discard this card →" (Entrapment 61024). The
 * engine's `change-form-cost.test.ts` drives it (Work-Life Balance 61030's additional cost, Claustrophobia's rule).
 */

import { describe, expect, it } from "vitest";
import { alterEgoResponse, changeFormCost, discardThis, on } from "./abilities.js";
import { dealDamage } from "./effects.js";
import { validateDefinition } from "./validate.js";
import { theVillain } from "./values.js";

describe("changeFormCost (Entrapment 61024)", () => {
  it("is the engine's `changeForm` cost part, spread beside 'discard this card'", () => {
    expect(changeFormCost("hero")).toEqual({ changeForm: "hero" });
    expect(changeFormCost("alterEgo")).toEqual({ changeForm: "alterEgo" });
    expect({ ...changeFormCost("hero"), ...discardThis }).toEqual({ changeForm: "hero", discardSelf: true });
  });

  it("an Alter-Ego Response with it validates", () => {
    const definition = alterEgoResponse(
      on.enemySchemes({ categories: ["villain"] }),
      { cost: { ...changeFormCost("hero"), ...discardThis } },
      dealDamage(1, theVillain),
    );
    expect(validateDefinition(definition)).toEqual([]);
    expect(definition.cost).toEqual({ changeForm: "hero", discardSelf: true });
  });
});
