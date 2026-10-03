/**
 * docs/phase7-wave6.md §3.55: "that thwart removes 1 additional threat" for a thwart in progress (Operative Skill,
 * Gambit 37013). `modifyThwart({ extraThreat })` emits the engine's `EffectSpec modifyThwart`; the engine's
 * `thwart-extra-threat.test.ts` drives it.
 */

import { describe, expect, it } from "vitest";
import { interrupt, on, removeCounter } from "./abilities.js";
import { modifyThwart } from "./effects.js";
import { YOUR_IDENTITY } from "./index.js";
import { validateDefinition } from "./validate.js";
import { countersOn, self } from "./values.js";

describe("§3.55 `modifyThwart({ extraThreat })`", () => {
  it("Operative Skill's shape: 'When you thwart, remove 1 operative counter from here → that thwart removes 1 additional threat'", () => {
    const definition = interrupt(
      on.thwarts(YOUR_IDENTITY),
      { cost: removeCounter("operative") },
      modifyThwart({ extraThreat: 1 }),
    );
    expect(validateDefinition(definition)).toEqual([]);
    expect(definition.trigger).toMatchObject({ kind: "interrupt", forced: false, on: { on: "thwart" } });
    expect(definition.cost).toEqual({ spendCounters: { counterType: "operative", amount: 1 } });
    expect(definition.effects).toEqual([{ kind: "modifyThwart", extraThreat: { kind: "const", value: 1 } }]);
  });

  it("takes a value as well as a number", () => {
    expect(modifyThwart({ extraThreat: countersOn(self, "operative") })).toEqual({
      kind: "modifyThwart",
      extraThreat: countersOn(self, "operative"),
    });
  });
});
