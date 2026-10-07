/**
 * docs/phase7-wave7.md §3.19 (a): "Treat your identity's printed text box as if it were blank (except for traits)" with
 * the existing `blanksTextBox` builder. The engine's `blank-text-box-identity.test.ts` proves what the rule removes.
 */

import { describe, expect, it } from "vitest";
import { blanksTextBox, constant } from "./abilities.js";
import { defineAbilities } from "./validate.js";
import { query } from "./values.js";

describe("§3.19 (a) blanksTextBox on an identity", () => {
  it("an attachment blanks the identity it is attached to", () => {
    const registry = defineAbilities({
      "99019.constant": constant(blanksTextBox(query("identity", { hostOfSelf: true }))),
    });
    expect(registry["99019.constant"]?.trigger).toEqual({
      kind: "constant",
      rules: [{ kind: "blankTextBox", target: { categories: ["identity"], hostOfSelf: true } }],
    });
  });

  it("an obligation blanks the identity of the player whose play area it is in, with no keyword exception", () => {
    const registry = defineAbilities({
      "99020.constant": constant(blanksTextBox(query("identity", { controller: "you" }))),
    });
    expect(registry["99020.constant"]?.trigger).toEqual({
      kind: "constant",
      rules: [{ kind: "blankTextBox", target: { categories: ["identity"], controller: "you" } }],
    });
  });
});
