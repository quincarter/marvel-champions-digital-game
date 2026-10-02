/**
 * docs/phase7-wave6.md §3.59: threat on characters. MojoMania 1B's "When a character flips or leaves play, move all
 * threat from that character to this scheme" (`mojo` 39025b) as a pattern over the hero's change of form, a card's flip
 * and its leaving play (`threat-on-characters.test.ts` drives it in the engine).
 */

import { describe, expect, it } from "vitest";
import { forcedInterrupt, on } from "./abilities.js";
import { moveThreat } from "./effects.js";
import { validateDefinition } from "./validate.js";
import { eventTarget } from "./values.js";

describe("§3.59 threat on characters", () => {
  it("MojoMania 1B: a forced interrupt to a character flipping or leaving play", () => {
    const definition = forcedInterrupt(on.characterFlipsOrLeavesPlay(), moveThreat(eventTarget, { kind: "self" }));
    expect(validateDefinition(definition)).toEqual([]);
    expect(definition.trigger).toEqual({
      kind: "interrupt",
      forced: true,
      on: { on: ["formChanged", "cardFlipped", "cardLeavesPlay"], targetIs: { categories: ["character"] } },
    });
    expect(definition.effects).toEqual([{ kind: "moveThreat", from: { kind: "eventTarget" }, to: { kind: "self" } }]);
  });

  it("characterFlips: the change of form and the flip, narrowed by `who`", () => {
    expect(on.characterFlips()).toEqual({
      on: ["formChanged", "cardFlipped"],
      targetIs: { categories: ["character"] },
    });
    expect(on.characterFlips("self")).toEqual({ on: ["formChanged", "cardFlipped"], selfIs: "target" });
  });
});
