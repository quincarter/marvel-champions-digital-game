/**
 * docs/phase7-wave7.md §3.64: the DSL builders for "You cannot flip your [name] upgrades", a flip cost, and "flip each
 * of your [TRAIT] upgrades to its [named] side and exhaust it" (§4.1 Q43 = A) composed from existing builders. The
 * engine's `cannot-flip.test.ts` proves what they do.
 */

import { trait } from "@mc/content";
import { describe, expect, it } from "vitest";
import { action, cannotFlip, constant, exhaust, flipCard, flipThis, whenRevealed } from "./index.js";
import { defineAbilities } from "./validate.js";
import { each, exists, query, you } from "./values.js";

describe("§3.64 cannotFlip and flipThis", () => {
  it("cannotFlip compiles to the rule, with and without a condition", () => {
    const edges = query("upgrade", { name: "Edge", controlledBy: you });
    expect(constant(cannotFlip(edges)).trigger).toEqual({
      kind: "constant",
      rules: [{ kind: "cannotFlip", target: { categories: ["upgrade"], name: "Edge", controlledBy: you } }],
    });
    const whileSwitched = exists(query("support", { name: "Switch" }));
    expect(constant(cannotFlip(edges, { while: whileSwitched })).trigger).toEqual({
      kind: "constant",
      rules: [{ kind: "cannotFlip", target: edges, while: whileSwitched }],
    });
  });

  it("flipThis is the flip cost", () => {
    expect(flipThis).toEqual({ flipSelf: true });
    expect(action({ cost: flipThis }, exhaust({ kind: "self" })).cost).toEqual({ flipSelf: true });
  });

  it("an obligation with the rule and 'flip each to its Edge side and exhaust it' validates", () => {
    const yours = { trait: trait("Energy"), controlledBy: you } as const;
    const registry = defineAbilities({
      "99064.constant": constant(cannotFlip(query("upgrade", { name: "Edge", controlledBy: you }))),
      // One already showing Edge is not named by the flip, and is exhausted with the rest (Q43 = A).
      "99064.when-revealed": whenRevealed(
        flipCard(each(query("upgrade", { ...yours, name: "Blade" }))),
        exhaust(each(query("upgrade", yours))),
      ),
    });
    expect(registry["99064.when-revealed"]?.effects).toEqual([
      { kind: "flipCard", target: { kind: "each", query: { categories: ["upgrade"], ...yours, name: "Blade" } } },
      { kind: "exhaust", target: { kind: "each", query: { categories: ["upgrade"], ...yours } } },
    ]);
  });
});
