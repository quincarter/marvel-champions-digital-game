/**
 * The Elephant's Trunk (`bp` 51007): "Exhaust The Elephant's Trunk and up to 2 other Wakanda allies and/or supports
 * you control →". `exhaustCardsCost(…, { includingThis: true })` emits one `InPlayCostPick` that always holds the
 * ability's own card (`includesSelf`; `in-play-cost-includes-self.test.ts` drives it in the engine). RRG 1.8 FAQ p. 65:
 * the card itself meets the minimum of one (RRG 1.8 "Cost", p. 14), which every other pick still needs.
 */

import { trait } from "@mc/content";
import { describe, expect, it } from "vitest";
import { alterEgoAction, exhaustCardsCost, exhaustThis } from "./abilities.js";
import { draw } from "./effects.js";
import { validateDefinition } from "./validate.js";
import { query, varOf } from "./values.js";

const WAKANDA = query(["ally", "support"], { trait: trait("WAKANDA") });

describe("`exhaustCardsCost` with `includingThis`", () => {
  it("the Trunk's shape: one pick of 1 to 3 that holds the card, counted into the bound var", () => {
    const cost = exhaustCardsCost(WAKANDA, { includingThis: true, max: 3, bind: "n" });
    expect(cost).toEqual({
      exhaustCards: { slot: "exhausted", query: WAKANDA, min: 1, max: 3, includesSelf: true, bind: "n" },
    });
    expect(validateDefinition(alterEgoAction({ cost }, draw(varOf("n"))))).toEqual([]);
  });

  it("the minimum of one still holds: `includingThis` with min 0 is refused, as for any pick (RRG 1.8 'Cost', p. 14)", () => {
    const cost = exhaustCardsCost(WAKANDA, { includingThis: true, min: 0, max: 2 });
    expect(validateDefinition(alterEgoAction({ cost }, draw(1)))).toEqual([
      'cost exhaustCards: min must be a whole number of at least 1 (RRG 1.8 "Cost", p. 14)',
    ]);
  });

  it("the pick of others the Trunk could not use is still refused: `exhaustThis` plus 'up to 2' with min 0", () => {
    const cost = [exhaustThis, exhaustCardsCost(WAKANDA, { min: 0, max: 2 })];
    expect(validateDefinition(alterEgoAction({ cost }, draw(1)))).toEqual([
      'cost exhaustCards: min must be a whole number of at least 1 (RRG 1.8 "Cost", p. 14)',
    ]);
  });

  it("not beside `exhaustThis` (the card would pay twice), and not on an `each` cost", () => {
    const twice = [exhaustThis, exhaustCardsCost(WAKANDA, { includingThis: true, max: 3 })];
    expect(validateDefinition(alterEgoAction({ cost: twice }, draw(1)))).toEqual([
      'cost exhaustCards: includesSelf already exhausts this card; with exhaustSelf it would pay twice (RRG 1.8 "Cost", p. 13)',
    ]);
    expect(() => exhaustCardsCost(WAKANDA, { includingThis: true, each: true })).toThrow(/each/);
  });

  it("a pick without it carries no `includesSelf` (every existing cost is unchanged)", () => {
    expect(exhaustCardsCost(WAKANDA, { max: 2 })).toEqual({
      exhaustCards: { slot: "exhausted", query: WAKANDA, min: 1, max: 2 },
    });
  });
});
