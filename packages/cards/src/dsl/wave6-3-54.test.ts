/**
 * docs/phase7-wave6.md §3.54: the DSL side of "look at the top 2 cards of the encounter deck. Discard 1 of those cards
 * →" (Thief Extraordinaire, Remy LeBeau 37001b). `encounterLookDiscardCost` compiles to the engine's
 * `AbilityCost.encounterLookDiscard`; the engine's `encounter-look-discard-cost.test.ts` drives the behaviour.
 */

import { describe, expect, it } from "vitest";
import { action, encounterLookDiscardCost, exhaustThis, resource } from "./abilities.js";
import { draw, removeThreatFromAScheme } from "./effects.js";
import { validateDefinition } from "./validate.js";
import { boostIconsOn, chosen } from "./values.js";

describe("§3.54 encounterLookDiscardCost", () => {
  it("compiles to the engine's cost", () => {
    expect(encounterLookDiscardCost(2, 1, "stolen")).toEqual({
      encounterLookDiscard: { look: 2, discard: 1, slot: "stolen" },
    });
  });

  it("Thief Extraordinaire's shape validates: exhaust and look-discard, then threat equal to that card's boost icons", () => {
    const definition = action(
      { label: "thwart", cost: [exhaustThis, encounterLookDiscardCost(2, 1, "stolen")] },
      removeThreatFromAScheme(boostIconsOn(chosen("stolen"))),
    );
    expect(validateDefinition(definition)).toEqual([]);
    expect(definition.cost).toEqual({
      exhaustSelf: true,
      encounterLookDiscard: { look: 2, discard: 1, slot: "stolen" },
    });
    expect(definition.label).toEqual(["thwart"]);
  });

  it("binds the slot, its count and its boost icons, and nothing else", () => {
    const reads = (n: Parameters<typeof draw>[0]) =>
      validateDefinition(action({ cost: encounterLookDiscardCost(2, 1, "stolen") }, draw(n)));
    expect(reads({ kind: "var", name: "stolen.count" })).toEqual([]);
    expect(reads({ kind: "var", name: "stolen.boostIcons" })).toEqual([]);
    expect(reads({ kind: "var", name: "loot.count" }).join(" ")).toContain("loot.count");
  });

  it("refuses a discard of none, more than it looks at, no slot, or a resource ability", () => {
    const shaped = (cost: ReturnType<typeof encounterLookDiscardCost>) => validateDefinition(action({ cost }, draw(1)));
    const problem = "cost encounterLookDiscard: needs a slot and whole numbers with 1 <= discard <= look";
    expect(shaped(encounterLookDiscardCost(2, 0, "stolen"))).toContain(problem);
    expect(shaped(encounterLookDiscardCost(1, 2, "stolen"))).toContain(problem);
    expect(shaped(encounterLookDiscardCost(2, 1.5, "stolen"))).toContain(problem);
    expect(shaped(encounterLookDiscardCost(2, 1, ""))).toContain(problem);
    expect(shaped(encounterLookDiscardCost(3, 3, "stolen"))).toEqual([]);
    const onResource = resource({ wild: 1 }, { cost: encounterLookDiscardCost(2, 1, "stolen") });
    expect(validateDefinition(onResource)).toContain("cost encounterLookDiscard: not on a resource ability");
  });
});
