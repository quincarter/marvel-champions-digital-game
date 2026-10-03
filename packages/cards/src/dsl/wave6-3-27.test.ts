/**
 * docs/phase7-wave6.md §3.27: "You take the first turn during the player phase". `takesFirstTurn` emits the `RuleSpec
 * takesFirstTurn` the engine's `beginPlayerPhase` reads (`takes-first-turn.test.ts` drives it). Field Commander's second
 * sentence composes from §3.13's `losesKeyword` over §3.26's temporary keyword.
 */

import { describe, expect, it } from "vitest";
import { constant, losesKeyword, takesFirstTurn } from "./abilities.js";
import { validateDefinition } from "./validate.js";
import { each, inPlay, ofIdentitySetTitled, query, you } from "./values.js";

describe("§3.27 `takesFirstTurn`", () => {
  it("Field Commander's first sentence: you take the first turn", () => {
    const definition = constant(takesFirstTurn(you));
    expect(validateDefinition(definition)).toEqual([]);
    expect(definition.trigger).toEqual({
      kind: "constant",
      rules: [{ kind: "takesFirstTurn", player: { kind: "controller" } }],
    });
  });

  it("`while` is carried through", () => {
    const definition = constant(takesFirstTurn(you, { while: inPlay("Cyclops") }));
    expect(validateDefinition(definition)).toEqual([]);
    expect(definition.trigger).toEqual({
      kind: "constant",
      rules: [
        {
          kind: "takesFirstTurn",
          player: { kind: "controller" },
          while: { kind: "exists", query: { name: "Cyclops" } },
        },
      ],
    });
  });

  it("the second sentence composes: each Cyclops upgrade attached to a minion loses temporary", () => {
    const definition = constant(
      losesKeyword(
        { name: "temporary" },
        query("upgrade", { ...ofIdentitySetTitled("Cyclops"), host: each(query("minion")) }),
      ),
    );
    expect(validateDefinition(definition)).toEqual([]);
    expect(definition.trigger).toEqual({
      kind: "constant",
      keywordGrants: [
        {
          keyword: { name: "temporary" },
          target: {
            categories: ["upgrade"],
            identitySetTitled: { names: ["Cyclops"] },
            host: { kind: "each", query: { categories: ["minion"] } },
          },
          loses: true,
        },
      ],
    });
  });
});
