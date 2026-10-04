/**
 * docs/phase7-wave6.md §3.14: "cannot recover". `cannotRecover` emits the `RuleSpec cannotRecover` the engine's basic
 * recovery reads (`cannot-recover.test.ts` drives it).
 */

import { describe, expect, it } from "vitest";
import { cannotRecover, constant } from "./abilities.js";
import { validateDefinition } from "./validate.js";
import { controllerOf, host, inPlay, you } from "./values.js";

describe("§3.14 `cannotRecover`", () => {
  it("Wrapped in Metal's shape: the attached identity's player cannot recover", () => {
    const definition = constant(cannotRecover(controllerOf(host)));
    expect(validateDefinition(definition)).toEqual([]);
    expect(definition.trigger).toEqual({
      kind: "constant",
      rules: [{ kind: "cannotRecover", player: { kind: "controllerOf", target: { kind: "host" } } }],
    });
  });

  it("`while` is carried through", () => {
    const definition = constant(cannotRecover(you, { while: inPlay("Magneto") }));
    expect(validateDefinition(definition)).toEqual([]);
    expect(definition.trigger).toEqual({
      kind: "constant",
      rules: [
        {
          kind: "cannotRecover",
          player: { kind: "controller" },
          while: { kind: "exists", query: { name: "Magneto" } },
        },
      ],
    });
  });
});
