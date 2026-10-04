/**
 * docs/phase7-wave6.md §3.84: `on.attackFromAbility`, "When you use your 'Optic Blast' ability" (Full Blast 33008).
 * The engine's `attack-source-ability.test.ts` drives the pattern.
 */

import { describe, expect, it } from "vitest";
import { interrupt, on } from "./abilities.js";
import { modifyAttack } from "./effects.js";
import { validateDefinition } from "./validate.js";

describe("§3.84 `on.attackFromAbility`", () => {
  it("names the ability whose attack it hears", () => {
    expect(on.attackFromAbility("33001a.cyclops-constant")).toEqual({
      on: "attack",
      sourceAbility: "33001a.cyclops-constant",
    });
    expect(on.attackFromAbility(["a.one", "b.two"])).toEqual({ on: "attack", sourceAbility: ["a.one", "b.two"] });
  });

  it("Full Blast's shape validates", () => {
    const definition = interrupt(
      on.attackFromAbility("33001a.cyclops-constant"),
      modifyAttack({ extraDamage: 8, overkill: true }),
    );
    expect(validateDefinition(definition)).toEqual([]);
  });
});
