/**
 * `removeAllCounters`: "Remove each [type] counter from [card] →" (Bishop, `gambit` 37011), the no-choice sibling of
 * `removeUpToCounters`. The engine pays it in `selectCost` (`engine/src/remove-each-counter-cost.test.ts`). Shapes only.
 */

import { describe, expect, it } from "vitest";
import { interrupt, on, removeAllCounters, removeUpToCounters } from "./abilities.js";
import { modifyAttack } from "./effects.js";
import { validateDefinition } from "./validate.js";
import { min, scaled, varOf } from "./values.js";

describe("removeAllCounters", () => {
  it("Bishop's interrupt: remove each energy counter → +2 ATK for each, to a maximum of +6", () => {
    const definition = interrupt(
      on.attacks("self"),
      { cost: removeAllCounters("energy", { bind: "removed" }) },
      modifyAttack({ atkBonus: min(scaled(varOf("removed"), { times: 2 }), 6) }),
    );
    expect(validateDefinition(definition)).toEqual([]);
    expect(definition.cost).toEqual({
      spendCounters: { counterType: "energy", amount: 1, all: true, bind: "removed" },
    });
  });

  it("carries the holder like removeUpToCounters: your identity", () => {
    expect(removeAllCounters("charge", { bind: "n", fromIdentity: true })).toEqual({
      spendCounters: { counterType: "charge", amount: 1, all: true, bind: "n", target: "identity" },
    });
  });

  it("validation: a counter cost cannot be both 'up to' and 'each'", () => {
    const upTo = removeUpToCounters("energy", 3, { bind: "n" });
    const both = interrupt(on.attacks("self"), { cost: { spendCounters: { ...upTo.spendCounters!, all: true } } });
    expect(validateDefinition(both)).toContain(
      'cost spendCounters: a counter cost is either "up to" or "each", not both',
    );
  });
});
