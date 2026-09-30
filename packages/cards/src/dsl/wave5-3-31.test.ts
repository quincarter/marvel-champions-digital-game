/**
 * docs/phase7-wave5.md §3.31: a printed text box that cannot be blanked (SP//dr Suit 1B and SP//dr, `spdr` 31001b /
 * 31002b). The builder validates and emits the plain rule `unblankable-text-box.test.ts` (engine) drives.
 */

import { describe, expect, it } from "vitest";
import { constant, textBoxCannotBeBlanked } from "./abilities.js";
import { validateDefinition } from "./validate.js";

describe("§3.31 'This card's printed text box cannot be treated as if it were blank'", () => {
  it("constant(textBoxCannotBeBlanked()) is one self rule with no target or condition", () => {
    const definition = constant(textBoxCannotBeBlanked());
    expect(validateDefinition(definition)).toEqual([]);
    expect(definition.trigger).toEqual({ kind: "constant", rules: [{ kind: "textBoxCannotBeBlanked" }] });
  });
});
