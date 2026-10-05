/**
 * docs/phase7-wave7.md §3.36 gap 1: the DSL builder for a constant rule that makes other cards enter play exhausted
 * ("Your allies, upgrades, and supports enter play exhausted."). The engine's `enters-play-exhausted-rule.test.ts`
 * drives the compiled rule.
 */

import { describe, expect, it } from "vitest";
import { constant, entersPlayExhausted } from "./abilities.js";
import { defineAbilities } from "./validate.js";
import { isAlterEgo, query, you } from "./values.js";

describe("§3.36 entersPlayExhausted", () => {
  const yours = query(["ally", "upgrade", "support"], { controlledBy: you });

  it("compiles to the engine's rule, with its condition when one is given", () => {
    expect(entersPlayExhausted(yours)).toEqual({
      rules: [
        {
          kind: "entersPlayExhausted",
          target: { categories: ["ally", "upgrade", "support"], controlledBy: { kind: "controller" } },
        },
      ],
    });
    expect(entersPlayExhausted(yours, { while: isAlterEgo() })).toEqual({
      rules: [{ kind: "entersPlayExhausted", target: yours, while: isAlterEgo() }],
    });
  });

  it("is a constant ability on the card that carries it, which validates", () => {
    const registry = defineAbilities({ "40171.mind-trap-constant": constant(entersPlayExhausted(yours)) });
    expect(registry["40171.mind-trap-constant"]).toEqual({
      trigger: { kind: "constant", rules: [{ kind: "entersPlayExhausted", target: yours }] },
      effects: [],
    });
  });
});
