/**
 * docs/phase7-wave7.md §3.59 and §3.69: `on.attacks(by, { has })`, "When you make a ranged attack" / "an attack that
 * has a keyword (overkill, piercing, or ranged)", and "(Max 1 per attack.)" as `maxOnePerTriggeringInstance` on the
 * event's interrupt. The engine's `attack-has-keyword.test.ts` drives both.
 */

import { describe, expect, it } from "vitest";
import { heroInterrupt, maxOnePerTriggeringInstance, on } from "./abilities.js";
import { modifyAttack } from "./effects.js";
import { validateDefinition } from "./validate.js";
import { YOUR_IDENTITY } from "./values.js";

describe("§3.59 / §3.69 an attack that has a keyword", () => {
  it("on.attacks(YOUR_IDENTITY, { has: ['ranged'] }) is your identity's attack with the keyword filter", () => {
    expect(on.attacks(YOUR_IDENTITY, { has: ["ranged"] })).toEqual({
      on: "attack",
      sourceIs: { categories: ["identity"], controller: "you" },
      attackHas: ["ranged"],
    });
    // No filter, no field: every other attack pattern is unchanged.
    expect(on.attacks(YOUR_IDENTITY)).toEqual({
      on: "attack",
      sourceIs: { categories: ["identity"], controller: "you" },
    });
    expect(on.attacks(YOUR_IDENTITY, { has: [] })).toEqual(on.attacks(YOUR_IDENTITY));
  });

  it("'(overkill, piercing, or ranged) … (Max 1 per attack.)' is the three keywords and the per-instance maximum", () => {
    const definition = {
      ...heroInterrupt(
        on.attacks(YOUR_IDENTITY, { has: ["overkill", "piercing", "ranged"] }),
        modifyAttack({ extraDamage: 2 }),
      ),
      limit: maxOnePerTriggeringInstance,
    };
    expect(definition.trigger).toMatchObject({
      kind: "interrupt",
      form: "hero",
      on: { on: "attack", attackHas: ["overkill", "piercing", "ranged"] },
    });
    expect(definition.limit).toEqual({ count: 1, period: "phase", per: "triggeringEvent" });
    expect(validateDefinition(definition)).toEqual([]);
  });
});
