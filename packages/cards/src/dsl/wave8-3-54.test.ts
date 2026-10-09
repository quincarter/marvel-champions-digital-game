/**
 * docs/phase7-wave8.md §3.54: the builder for "Ready your sidekick →". `readyCardsCost(query, opts)` emits the
 * engine's plain cost (`ready-cards-cost.test.ts` in the engine drives it).
 */

import { describe, expect, it } from "vitest";
import { heroAction, readyCardsCost } from "./abilities.js";
import { heal, ready } from "./effects.js";
import { validateDefinition } from "./validate.js";
import { chosen, query, yourIdentity } from "./values.js";

const ALLY = query("ally", { controller: "you" });

describe("§3.54 `readyCardsCost`", () => {
  it("one card by default, bound to `readied`; the effects may read the slot", () => {
    expect(readyCardsCost(ALLY)).toEqual({ readyCards: { slot: "readied", query: ALLY, min: 1, max: 1 } });
    const definition = heroAction({ cost: readyCardsCost(ALLY) }, ready(yourIdentity), heal(1, chosen("readied")));
    expect(validateDefinition(definition)).toEqual([]);
  });

  it("takes the in-play pick options; a minimum of 0 is refused (RRG 1.8 'Cost', p. 14)", () => {
    expect(readyCardsCost(ALLY, { max: "any", slot: "team", bind: "count" })).toEqual({
      readyCards: { slot: "team", query: ALLY, min: 1, bind: "count" },
    });
    const none = heroAction({ cost: readyCardsCost(ALLY, { min: 0, max: 1 }) }, ready(yourIdentity));
    expect(validateDefinition(none).join("\n")).toMatch(/cost readyCards: min must be a whole number of at least 1/);
  });
});
