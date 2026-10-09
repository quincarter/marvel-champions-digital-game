/**
 * docs/phase7-wave8.md §3.49: `playableTopOfDeck`, the DSL part of "Once per phase, you may play the top card of your
 * deck as if it was in your hand, reducing its resource cost by 1." (Magik 45030a). The engine's behavior is proven in
 * `packages/engine/src/playable-top-of-deck.test.ts`; this file proves what the builder emits and what validates.
 */

import { describe, expect, it } from "vitest";
import { constant, playableTopOfDeck, playWithTopOfDeckFaceup } from "./abilities.js";
import { validateDefinition } from "./validate.js";

describe("§3.49 playableTopOfDeck", () => {
  it("emits the permission on the constant and its once-per-phase as the ability's own limit", () => {
    const definition = constant(playableTopOfDeck({ costReduction: 1, limit: "phase" }));
    expect(definition).toEqual({
      trigger: { kind: "constant", playableTopOfDeck: { player: { kind: "controller" }, costReduction: 1 } },
      limit: { count: 1, period: "phase" },
      effects: [],
    });
    expect(validateDefinition(definition)).toEqual([]);
  });

  it("with no reduction and no limit it is the bare permission", () => {
    const definition = constant(playableTopOfDeck());
    expect(definition).toEqual({
      trigger: { kind: "constant", playableTopOfDeck: { player: { kind: "controller" } } },
      effects: [],
    });
    expect(validateDefinition(definition)).toEqual([]);
  });

  it("a constant has one permission at most, and a limit only with it", () => {
    expect(() => constant(playableTopOfDeck(), playableTopOfDeck())).toThrow("at most one playableTopOfDeck");
    expect(
      validateDefinition({ ...constant(playWithTopOfDeckFaceup()), limit: { count: 1, period: "phase" } }),
    ).toEqual(["a constant ability has no cost, limit or label"]);
  });
});
