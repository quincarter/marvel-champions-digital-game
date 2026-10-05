/**
 * docs/phase7-wave7.md §3.51: `onlyCharacterRemovesThreat(target, character)`, "Characters other than [X] cannot remove
 * threat from [this scheme]" as a `threatCannotBeRemoved` rule with `exceptBy`. The engine's
 * `threat-cannot-be-removed-except-by.test.ts` drives the rule.
 */

import { describe, expect, it } from "vitest";
import { constant, onlyCharacterRemovesThreat } from "./abilities.js";
import { validateDefinition } from "./validate.js";
import { inForm, query } from "./values.js";

describe("§3.51 characters other than X cannot remove threat from here", () => {
  it("compiles to threatCannotBeRemoved with exceptBy, the named character's query", () => {
    const named = query("identity", { name: "Sentinel" });
    const definition = constant(onlyCharacterRemovesThreat({ self: true }, named));
    expect(definition).toEqual({
      trigger: {
        kind: "constant",
        rules: [
          {
            kind: "threatCannotBeRemoved",
            target: { self: true },
            exceptBy: { categories: ["identity"], name: "Sentinel" },
          },
        ],
      },
      effects: [],
    });
    expect(validateDefinition(definition)).toEqual([]);
  });

  it("carries a while condition, and leaves it out when none is given", () => {
    const [rule] = onlyCharacterRemovesThreat({ self: true }, query("identity"), { while: inForm("hero") }).rules ?? [];
    expect(rule).toMatchObject({ kind: "threatCannotBeRemoved", while: { kind: "form", form: "hero" } });
    const [plain] = onlyCharacterRemovesThreat({ self: true }, query("identity")).rules ?? [];
    expect(plain).not.toHaveProperty("while");
  });
});
