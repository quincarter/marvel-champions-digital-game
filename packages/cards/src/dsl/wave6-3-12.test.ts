/**
 * docs/phase7-wave6.md §3.12: "cannot be healed (by player card effects)". `cannotBeHealed` emits the
 * `RuleSpec cannotBeHealed` the engine's heal reads (`cannot-be-healed.test.ts` drives it).
 */

import { describe, expect, it } from "vitest";
import { cannotBeHealed, constant } from "./abilities.js";
import { validateDefinition } from "./validate.js";
import { inPlay, query } from "./values.js";

describe("§3.12 `cannotBeHealed`", () => {
  it("Protect the Senator's shape: Robert Kelly cannot be healed by player card effects", () => {
    const definition = constant(cannotBeHealed(query("ally", { name: "Robert Kelly" }), { bySource: "playerCard" }));
    expect(validateDefinition(definition)).toEqual([]);
    expect(definition.trigger).toEqual({
      kind: "constant",
      rules: [
        { kind: "cannotBeHealed", target: { categories: ["ally"], name: "Robert Kelly" }, bySource: "playerCard" },
      ],
    });
  });

  it("without `bySource` nothing heals it; `while` is carried through", () => {
    const definition = constant(cannotBeHealed(query("minion"), { while: inPlay("Sabretooth") }));
    expect(validateDefinition(definition)).toEqual([]);
    expect(definition.trigger).toEqual({
      kind: "constant",
      rules: [
        {
          kind: "cannotBeHealed",
          target: { categories: ["minion"] },
          while: { kind: "exists", query: { name: "Sabretooth" } },
        },
      ],
    });
  });
});
