/**
 * docs/phase7-wave7.md §3.10: the DSL builder for "cannot leave play" and its card-abilities form. The engine's
 * `card-abilities-cannot-remove.test.ts` proves what the rule stops and what it lets through.
 */

import { describe, expect, it } from "vitest";
import { cannotLeavePlay, constant } from "./abilities.js";
import { defineAbilities } from "./validate.js";
import { exists, query } from "./values.js";

describe("§3.10 cannotLeavePlay", () => {
  it("'Card abilities cannot remove this ally from play' is the rule limited to card abilities, on its own card", () => {
    const registry = defineAbilities({
      "99010.constant": constant(cannotLeavePlay({ self: true }, { by: "cardAbilities" })),
    });
    expect(registry["99010.constant"]?.trigger).toEqual({
      kind: "constant",
      rules: [{ kind: "cannotLeavePlay", target: { self: true }, by: "cardAbilities" }],
    });
  });

  it("without `by` it is the absolute rule, with its condition and no `by` field", () => {
    const scheme = query("sideScheme", { name: "Day of Reckoning" });
    const whileVillain = exists(query("minion", { name: "Wrecker" }));
    expect(constant(cannotLeavePlay(scheme, { while: whileVillain })).trigger).toEqual({
      kind: "constant",
      rules: [{ kind: "cannotLeavePlay", target: scheme, while: whileVillain }],
    });
    expect(constant(cannotLeavePlay(scheme)).trigger).toEqual({
      kind: "constant",
      rules: [{ kind: "cannotLeavePlay", target: scheme }],
    });
  });
});
