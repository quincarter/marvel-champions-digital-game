/**
 * docs/phase7-wave6.md §3.38: `losesIcon`, "While there is no threat here, this scheme loses the [amplify] icon"
 * (Consume the World, 34030). The engine's `scheme-loses-icon.test.ts` drives the rule.
 */

import { describe, expect, it } from "vitest";
import { constant, losesIcon } from "./abilities.js";
import { validateDefinition } from "./validate.js";
import { self, threatOn, valueAtMost } from "./values.js";

describe("§3.38 `losesIcon`", () => {
  it("Consume the World's shape: a constant rule losing its own amplify icon at no threat", () => {
    const noThreat = valueAtMost(threatOn(self), 0);
    const definition = constant(losesIcon("amplify", { self: true }, { while: noThreat }));
    expect(validateDefinition(definition)).toEqual([]);
    expect(definition.trigger).toEqual({
      kind: "constant",
      rules: [{ kind: "gainsIcon", icon: "amplify", target: { self: true }, loses: true, while: noThreat }],
    });
  });

  it("with no `while`, none is emitted", () => {
    expect(losesIcon("hazard", { self: true })).toEqual({
      rules: [{ kind: "gainsIcon", icon: "hazard", target: { self: true }, loses: true }],
    });
  });
});
