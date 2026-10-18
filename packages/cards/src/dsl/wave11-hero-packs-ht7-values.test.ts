/**
 * docs/phase7-wave11-hero-packs.md H3.12 (`atEndOfThwart`, Stakeout 61014) and the review's follow-ups (`hitPointsOf`,
 * Valkyrie 62014; `canPlayFromHand`, Suggestion 61033): the DSL's vocabulary. The engine's `thwart-end-results.test.ts`,
 * `hit-points-value.test.ts` and `can-play-from-hand.test.ts` drive the behavior.
 */

import { describe, expect, it } from "vitest";
import { addCounters, atEndOfThwart } from "./effects.js";
import { canPlayFromHand, hitPointsOf, self } from "./values.js";

describe("wave 11 hero-pack DSL", () => {
  it("`atEndOfThwart` wraps its effects", () => {
    expect(atEndOfThwart(addCounters("evidence", 2))).toMatchObject({
      kind: "atEndOfThwart",
      effects: [{ kind: "addCounters", counterType: "evidence" }],
    });
  });

  it("`hitPointsOf` reads the modified maximum", () => {
    expect(hitPointsOf(self)).toEqual({ kind: "hitPoints", of: { kind: "self" } });
  });

  it("`canPlayFromHand` carries its filter and leaves out what it is not given", () => {
    expect(canPlayFromHand({ name: "spark" })).toEqual({
      kind: "canPlayFromHand",
      player: { kind: "controller" },
      filter: { name: "spark" },
    });
    expect(canPlayFromHand()).toEqual({ kind: "canPlayFromHand", player: { kind: "controller" } });
  });
});
