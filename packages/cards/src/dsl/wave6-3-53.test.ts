/**
 * docs/phase7-wave6.md §3.53: the DSL side of "place 1 charge counter on Gambit →" (Natural Agility, Gambit 37008).
 * `placeCountersCost` compiles to the engine's `AbilityCost.placeCounters`; the engine's `place-counters-cost.test.ts`
 * drives the behavior.
 */

import { trait } from "@mc/content";
import { describe, expect, it } from "vitest";
import { heroInterrupt, on, placeCountersCost, removeUpToCounters } from "./abilities.js";
import { draw } from "./effects.js";
import { validateDefinition } from "./validate.js";
import { countersOn, query, yourIdentity } from "./values.js";

describe("§3.53 placeCountersCost", () => {
  it("compiles: one on the ability's own card by default, or on your identity", () => {
    expect(placeCountersCost("charge")).toEqual({ placeCounters: { counterType: "charge", amount: 1 } });
    expect(placeCountersCost("charge", 2, { onIdentity: true })).toEqual({
      placeCounters: { counterType: "charge", amount: 2, target: "identity" },
    });
  });

  it("Natural Agility's shape validates: the cost places on the identity, the effect counts there", () => {
    const definition = heroInterrupt(
      on.youPlay(query("event", { trait: trait("ATTACK") })),
      { cost: placeCountersCost("charge", 1, { onIdentity: true }) },
      draw(countersOn(yourIdentity, "charge")),
    );
    expect(validateDefinition(definition)).toEqual([]);
    expect(definition.cost).toEqual({ placeCounters: { counterType: "charge", amount: 1, target: "identity" } });
  });

  it("refuses a placement of no counters, or of no type", () => {
    const shaped = (cost: ReturnType<typeof placeCountersCost>) =>
      heroInterrupt(on.youPlay(query("event")), { cost }, draw(1));
    const problem = "cost placeCounters: needs a counter type and a whole number of at least 1";
    expect(validateDefinition(shaped(placeCountersCost("charge", 0)))).toContain(problem);
    expect(validateDefinition(shaped(placeCountersCost("charge", 1.5)))).toContain(problem);
    expect(validateDefinition(shaped(placeCountersCost("", 1)))).toContain(problem);
    // Beside a counter cost of the same type, as a component of one cost.
    expect(
      validateDefinition(
        shaped({ ...removeUpToCounters("charge", 3, { bind: "removed" }), ...placeCountersCost("charge") }),
      ),
    ).toEqual([]);
  });
});
