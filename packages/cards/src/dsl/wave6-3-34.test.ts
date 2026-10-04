/**
 * docs/phase7-wave6.md §3.34: `cannotActivate`, "Attached minion cannot activate" (Mental Paralysis, `phoenix` 34008).
 * The engine's `cannot-activate.test.ts` drives the rule.
 */

import { describe, expect, it } from "vitest";
import { cannotActivate, constant } from "./abilities.js";
import { validateDefinition } from "./validate.js";
import { exists, query } from "./values.js";

describe("§3.34 `cannotActivate`", () => {
  it("Mental Paralysis's shape: a constant rule naming the attached minion", () => {
    const definition = constant(cannotActivate(query("minion", { hostOfSelf: true })));
    expect(validateDefinition(definition)).toEqual([]);
    expect(definition.trigger).toEqual({
      kind: "constant",
      rules: [{ kind: "cannotActivate", target: { categories: ["minion"], hostOfSelf: true } }],
    });
  });

  it("carries a `while`", () => {
    const whileAVillain = exists(query("villain"));
    expect(cannotActivate(query("minion"), { while: whileAVillain })).toEqual({
      rules: [{ kind: "cannotActivate", target: { categories: ["minion"] }, while: whileAVillain }],
    });
  });
});
