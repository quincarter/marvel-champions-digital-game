/**
 * docs/phase7-wave6.md §3.68: damage by its source's printed resource, and doubled damage. The builders emit the
 * `RuleSpec`s the engine's damage step reads (`damage-by-printed-resource.test.ts` drives them).
 */

import { describe, expect, it } from "vitest";
import { constant, doubleDamageTaken, increaseDamageTaken, takesDamageOnlyFrom } from "./abilities.js";
import { validateDefinition } from "./validate.js";

describe("§3.68 damage by printed resource", () => {
  it("Goblin: can only take damage from cards with a printed [physical] resource", () => {
    const definition = constant(takesDamageOnlyFrom({ self: true }, { printedResource: "physical" }));
    expect(validateDefinition(definition)).toEqual([]);
    expect(definition.trigger).toEqual({
      kind: "constant",
      rules: [{ kind: "cannotTakeDamage", target: { self: true }, exceptFromSource: { printedResource: "physical" } }],
    });
  });

  it("Troll: takes 1 additional damage from each card with a printed [mental] resource", () => {
    const definition = constant(increaseDamageTaken({ self: true }, 1, { fromSource: { printedResource: "mental" } }));
    expect(validateDefinition(definition)).toEqual([]);
    expect(definition.trigger).toEqual({
      kind: "constant",
      rules: [
        { kind: "increaseDamageTaken", target: { self: true }, amount: 1, fromSource: { printedResource: "mental" } },
      ],
    });
  });

  it("Dragon and Vampire: doubled damage by source or by attack keyword", () => {
    const dragon = constant(doubleDamageTaken({ self: true }, { fromSource: { printedResource: "energy" } }));
    const vampire = constant(doubleDamageTaken({ self: true }, { attackKeyword: "piercing" }));
    expect(validateDefinition(dragon)).toEqual([]);
    expect(validateDefinition(vampire)).toEqual([]);
    expect(dragon.trigger).toEqual({
      kind: "constant",
      rules: [{ kind: "doubleDamageTaken", target: { self: true }, fromSource: { printedResource: "energy" } }],
    });
    expect(vampire.trigger).toEqual({
      kind: "constant",
      rules: [{ kind: "doubleDamageTaken", target: { self: true }, attackKeyword: "piercing" }],
    });
  });
});
