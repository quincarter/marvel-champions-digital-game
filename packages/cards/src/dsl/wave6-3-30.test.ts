/**
 * docs/phase7-wave6.md §3.30: "That attack gains piercing and ranged" on a resource ability (Ruby Quartz Visor 33003).
 * `thatAttackGainsKeywords` emits `applyRuleUntil` with `until: "endOfPaidFor"` and an `attackKeywords` rule keyed on
 * slot `paidFor` (`apply-rule-until-end-of-paid-for.test.ts` in the engine drives it).
 */

import { describe, expect, it } from "vitest";
import { resource } from "./abilities.js";
import { applyRuleUntil, thatAttackGainsKeywords } from "./effects.js";
import { exhaustThis, YOUR_IDENTITY } from "./index.js";
import { validateDefinition } from "./validate.js";

describe('§3.30 `applyRuleUntil(..., "endOfPaidFor")`', () => {
  it("Ruby Quartz Visor's shape: a resource for your identity's ability whose attack gains piercing and ranged", () => {
    const definition = resource(
      { energy: 1 },
      { cost: exhaustThis, generatesFor: YOUR_IDENTITY },
      thatAttackGainsKeywords(["piercing", "ranged"]),
    );
    expect(validateDefinition(definition)).toEqual([]);
    expect(definition.effects).toEqual([
      {
        kind: "applyRuleUntil",
        rule: { kind: "attackKeywords", keywords: ["piercing", "ranged"], via: { inSlot: "paidFor" } },
        until: "endOfPaidFor",
      },
    ]);
  });

  it("the plain builder accepts the new duration", () => {
    expect(
      applyRuleUntil({ kind: "attackKeywords", keywords: ["ranged"], via: { inSlot: "paidFor" } }, "endOfPaidFor"),
    ).toHaveProperty("until", "endOfPaidFor");
  });
});
