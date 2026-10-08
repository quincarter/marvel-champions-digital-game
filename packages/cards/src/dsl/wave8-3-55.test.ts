/**
 * docs/phase7-wave8.md §3.55: the builder for "discard up to N cards from the top of your deck →".
 * `discardUpToTopOfDeckCost(max, slot?)` emits the engine's plain cost (`deck-discard-choice-cost.test.ts` in the
 * engine drives it), and the text after the arrow reads the count as `cost.discardFromDeck`.
 */

import { describe, expect, it } from "vitest";
import { discardTopOfDeckCost, discardUpToTopOfDeckCost, interrupt, on } from "./abilities.js";
import { modifyAttack } from "./effects.js";
import { validateDefinition } from "./validate.js";
import { varOf } from "./values.js";

describe("§3.55 `discardUpToTopOfDeckCost`", () => {
  it("a chosen size from 1 to max, with an optional slot for the cards", () => {
    expect(discardUpToTopOfDeckCost(3)).toEqual({ discardFromDeck: { choose: { min: 1, max: 3 } } });
    expect(discardUpToTopOfDeckCost(2, "milled")).toEqual({
      discardFromDeck: { choose: { min: 1, max: 2 } },
      discardFromDeckSlot: "milled",
    });
  });

  it("the effects may read `cost.discardFromDeck`; a fixed deck discard binds no such var", () => {
    const bonus = modifyAttack({ atkBonus: varOf("cost.discardFromDeck") });
    expect(validateDefinition(interrupt(on.attacks("self"), { cost: discardUpToTopOfDeckCost(3) }, bonus))).toEqual([]);
    const fixed = validateDefinition(interrupt(on.attacks("self"), { cost: discardTopOfDeckCost(3) }, bonus));
    expect(fixed.join("\n")).toMatch(/cost\.discardFromDeck/);
  });

  it("refuses a chosen size that could be zero, or a max below the min", () => {
    const zero = interrupt(on.attacks("self"), { cost: { discardFromDeck: { choose: { min: 0, max: 3 } } } });
    expect(validateDefinition(zero).join("\n")).toMatch(/a chosen size has a min of at least 1/);
    const inverted = interrupt(on.attacks("self"), { cost: { discardFromDeck: { choose: { min: 2, max: 1 } } } });
    expect(validateDefinition(inverted).join("\n")).toMatch(/max must be a whole number no smaller than min/);
  });
});
