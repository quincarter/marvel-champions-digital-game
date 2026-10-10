/**
 * docs/phase7-wave9.md §3.7 (b): the builders for "remove [up to] N threat from [a card] →". They emit the engine's
 * plain cost (`remove-threat-cost.test.ts` in the engine drives it), and the text after the arrow reads the amount
 * removed as `cost.removeThreat`.
 */

import { describe, expect, it } from "vitest";
import { interrupt, on, removeThreatCost, removeThreatUpToCost } from "./abilities.js";
import { modifyAttack } from "./effects.js";
import { validateDefinition } from "./validate.js";
import { varOf } from "./values.js";

const self = { kind: "self" } as const;

describe("§3.7 (b) `removeThreatCost` and `removeThreatUpToCost`", () => {
  it("a fixed amount (1 unless given), or a chosen one from 1 to max", () => {
    expect(removeThreatCost(self)).toEqual({ removeThreat: { from: self, amount: 1 } });
    expect(removeThreatCost(self, 2)).toEqual({ removeThreat: { from: self, amount: 2 } });
    expect(removeThreatUpToCost(self, 3)).toEqual({
      removeThreat: { from: self, amount: { choose: { min: 1, max: 3 } } },
    });
  });

  it("the effects may read `cost.removeThreat`; without the cost no such var is bound", () => {
    const bonus = modifyAttack({ extraDamage: varOf("cost.removeThreat") });
    expect(validateDefinition(interrupt(on.attacks("self"), { cost: removeThreatUpToCost(self, 3) }, bonus))).toEqual(
      [],
    );
    expect(validateDefinition(interrupt(on.attacks("self"), { cost: removeThreatCost(self) }, bonus))).toEqual([]);
    expect(validateDefinition(interrupt(on.attacks("self"), {}, bonus)).join("\n")).toMatch(/cost\.removeThreat/);
  });

  it("refuses an amount that could be zero, or a max below the min", () => {
    const zero = interrupt(on.attacks("self"), { cost: { removeThreat: { from: self, amount: 0 } } });
    expect(validateDefinition(zero).join("\n")).toMatch(/must be a whole number of at least 1/);
    const upToZero = interrupt(on.attacks("self"), {
      cost: { removeThreat: { from: self, amount: { choose: { min: 0, max: 3 } } } },
    });
    expect(validateDefinition(upToZero).join("\n")).toMatch(/a chosen amount has a min of at least 1/);
    const inverted = interrupt(on.attacks("self"), {
      cost: { removeThreat: { from: self, amount: { choose: { min: 2, max: 1 } } } },
    });
    expect(validateDefinition(inverted).join("\n")).toMatch(/max must be a whole number no smaller than min/);
  });
});
