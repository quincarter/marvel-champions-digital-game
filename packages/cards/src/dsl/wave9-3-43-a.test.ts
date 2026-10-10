/**
 * docs/phase7-wave9.md §3.43 (a): `discardTopOfEncounterDeckCost` ("discard the top card of the encounter deck →",
 * Redwing 53002) and `discardChosenFromEncounterDeckCost` ("choose a number from 1 to 5, discard that many cards from
 * the top of the encounter deck →", Infiltration 51015), both `AbilityCost.discardFromEncounterDeck`. The engine's
 * `encounter-discard-cost.test.ts` drives them, the deck that holds fewer cards than chosen included (RRG 1.8
 * "Encounter Deck", p. 17).
 */

import type { AbilityCost } from "@mc/engine";
import { describe, expect, it } from "vitest";
import {
  action,
  discardChosenFromEncounterDeckCost,
  discardTopOfEncounterDeckCost,
  exhaustThis,
  heroAction,
  resource,
} from "./abilities.js";
import { cards, chooseCards, dealDamage, putIntoPlay, thwartAScheme } from "./effects.js";
import { validateDefinition } from "./validate.js";
import { chosen, sum, theVillain, varOf, you } from "./values.js";

describe("§3.43 (a) cards discarded from the top of the encounter deck as a cost", () => {
  it("discardTopOfEncounterDeckCost is a fixed number bound to a slot, 1 by default", () => {
    expect(discardTopOfEncounterDeckCost("top")).toEqual({ discardFromEncounterDeck: { amount: 1, slot: "top" } });
    expect(discardTopOfEncounterDeckCost("top", 5)).toEqual({ discardFromEncounterDeck: { amount: 5, slot: "top" } });
  });

  it("discardChosenFromEncounterDeckCost is a number the payer chooses", () => {
    expect(discardChosenFromEncounterDeckCost("discarded", { min: 1, max: 5 })).toEqual({
      discardFromEncounterDeck: { amount: { choose: { min: 1, max: 5 } }, slot: "discarded" },
    });
  });

  it("the effects read the slot, its count, the number chosen and the icons of the boost area", () => {
    const redwing = action(
      { cost: [exhaustThis, discardTopOfEncounterDeckCost("top")] },
      dealDamage(sum(varOf("top.boostIcons"), varOf("top.starIcons")), theVillain),
    );
    expect(redwing.cost).toMatchObject({ exhaustSelf: true, discardFromEncounterDeck: { amount: 1, slot: "top" } });
    expect(validateDefinition(redwing)).toEqual([]);
    const infiltration = heroAction(
      { label: "thwart", cost: discardChosenFromEncounterDeckCost("discarded", { min: 1, max: 5 }) },
      thwartAScheme(varOf("discarded.count")),
      dealDamage(varOf("discarded.chosen"), theVillain),
      chooseCards("minion", cards(chosen("discarded"), { categories: ["minion"] }), { min: 1, max: 1 }),
      putIntoPlay(chosen("minion"), you),
    );
    expect(validateDefinition(infiltration)).toEqual([]);
    // A slot the cost did not bind is still an unbound read.
    const unbound = action(
      { cost: discardTopOfEncounterDeckCost("top") },
      dealDamage(varOf("other.count"), theVillain),
    );
    expect(validateDefinition(unbound)).not.toEqual([]);
  });

  it("rejects a cost with no slot, a number below 1, an empty range, and one on a resource ability", () => {
    const problems = (options: { readonly cost: AbilityCost }) => validateDefinition(action(options, []));
    expect(problems({ cost: discardTopOfEncounterDeckCost("") })).toEqual([
      expect.stringContaining("needs a slot for the discarded cards"),
    ]);
    expect(problems({ cost: discardTopOfEncounterDeckCost("top", 0) })).toEqual([
      expect.stringContaining("must be a whole number of at least 1"),
    ]);
    expect(problems({ cost: discardChosenFromEncounterDeckCost("top", { min: 0, max: 5 }) })).toEqual([
      expect.stringContaining("a chosen number has a min of at least 1"),
    ]);
    expect(problems({ cost: discardChosenFromEncounterDeckCost("top", { min: 3, max: 2 }) })).toEqual([
      expect.stringContaining("max must be a whole number no smaller than min"),
    ]);
    const onResource = resource({ wild: 1 }, { cost: discardTopOfEncounterDeckCost("top") });
    expect(validateDefinition(onResource)).toContain("cost discardFromEncounterDeck: not on a resource ability");
  });
});
