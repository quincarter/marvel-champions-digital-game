/**
 * docs/phase7-wave6.md §3.7: `statusLimit(status, max, target)` (Colossus, `mut_gen` 32001a: "Colossus can have 1
 * additional tough status card."). The engine side is driven by `packages/engine/src/tough-limit.test.ts`.
 */

import { describe, expect, it } from "vitest";
import { anyNumberOfToughStatusCards, constant, statusLimit } from "./abilities.js";
import { validateDefinition } from "./validate.js";

describe("§3.7 `statusLimit`", () => {
  it("Colossus's shape: a numeric total on the character", () => {
    const colossus = constant(statusLimit("tough", 2, { self: true }));
    expect(validateDefinition(colossus)).toEqual([]);
    expect(colossus.trigger).toEqual({
      kind: "constant",
      rules: [{ kind: "statusLimit", target: { self: true }, status: "tough", max: 2 }],
    });
  });

  it("the unlimited form is Armadillo's builder", () => {
    expect(constant(statusLimit("tough", "unlimited", { self: true }))).toEqual(
      constant(anyNumberOfToughStatusCards({ self: true })),
    );
  });
});
