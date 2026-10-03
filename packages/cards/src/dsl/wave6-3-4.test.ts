/**
 * docs/phase7-wave6.md §3.4: "Nimrod cannot take more than 3 damage each phase." `maxDamageTaken` emits the engine's
 * `maxDamageTakenPerAttack` rule, with `per: "phase"` for Nimrod (`per-phase-damage-cap.test.ts` drives it).
 */

import { describe, expect, it } from "vitest";
import { constant, maxDamageTaken } from "./abilities.js";
import { validateDefinition } from "./validate.js";
import { inPlay } from "./values.js";

describe("§3.4 `maxDamageTaken`", () => {
  it("Nimrod's shape: a per-phase cap on himself", () => {
    const definition = constant(maxDamageTaken({ self: true }, 3, { per: "phase" }));
    expect(validateDefinition(definition)).toEqual([]);
    expect(definition.trigger).toEqual({
      kind: "constant",
      rules: [{ kind: "maxDamageTakenPerAttack", target: { self: true }, amount: 3, per: "phase" }],
    });
  });

  it("Cutthroat Ambition's shape: per attack is the default and writes no `per`, so wave 3's rule is unchanged", () => {
    expect(constant(maxDamageTaken({ hostOfSelf: true }, 5)).trigger).toEqual({
      kind: "constant",
      rules: [{ kind: "maxDamageTakenPerAttack", target: { hostOfSelf: true }, amount: 5 }],
    });
    expect(constant(maxDamageTaken({ hostOfSelf: true }, 5, { per: "attack" })).trigger).toEqual(
      constant(maxDamageTaken({ hostOfSelf: true }, 5)).trigger,
    );
  });

  it("`while` is carried through", () => {
    const definition = constant(maxDamageTaken({ self: true }, 3, { per: "phase", while: inPlay("Nimrod") }));
    expect(definition.trigger).toEqual({
      kind: "constant",
      rules: [
        {
          kind: "maxDamageTakenPerAttack",
          target: { self: true },
          amount: 3,
          per: "phase",
          while: { kind: "exists", query: { name: "Nimrod" } },
        },
      ],
    });
  });
});
