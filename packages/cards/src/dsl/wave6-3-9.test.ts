/**
 * docs/phase7-wave6.md §3.9: `youAre(status, { player, target, while })` (White Queen, `mut_gen` 32056: "While White
 * Queen is engaged with you, you are confused."; Telepathic Restraint, 32059). The engine side is driven by
 * `packages/engine/src/keeps-giving-status.test.ts`.
 */

import { describe, expect, it } from "vitest";
import { constant, youAre } from "./abilities.js";
import { validateDefinition } from "./validate.js";
import { isHero } from "./values.js";

describe("§3.9 `youAre`", () => {
  it("White Queen's shape: your identity is kept confused", () => {
    const queen = constant(youAre("confused"));
    expect(validateDefinition(queen)).toEqual([]);
    expect(queen.trigger).toEqual({
      kind: "constant",
      rules: [
        {
          kind: "keepsGivingStatus",
          target: { categories: ["identity"], controlledBy: { kind: "controller" } },
          status: "confused",
        },
      ],
    });
  });

  it("another player, a condition, or an explicit target", () => {
    const first = { kind: "firstPlayer" } as const;
    const ready = isHero();
    expect(constant(youAre("stunned", { player: first, while: ready })).trigger).toEqual({
      kind: "constant",
      rules: [
        {
          kind: "keepsGivingStatus",
          target: { categories: ["identity"], controlledBy: first },
          status: "stunned",
          while: ready,
        },
      ],
    });
    expect(constant(youAre("tough", { target: { self: true } })).trigger).toEqual({
      kind: "constant",
      rules: [{ kind: "keepsGivingStatus", target: { self: true }, status: "tough" }],
    });
  });
});
