/**
 * docs/phase7-wave7.md §3.36 gap 2: the DSL builder for "if your hero attacked and thwarted this phase". The engine's
 * `character-did-this-phase.test.ts` drives the compiled predicate.
 */

import { describe, expect, it } from "vitest";
import { heroAction } from "./abilities.js";
import { discard } from "./effects.js";
import { defineAbilities } from "./validate.js";
import { allOf, characterDidThisPhase, query, self, you } from "./values.js";

describe("§3.36 characterDidThisPhase", () => {
  const yourHero = query("identity", { controlledBy: you });

  it("compiles to the engine's predicate, one for the attack and one for the thwart", () => {
    expect(characterDidThisPhase(yourHero, "attack")).toEqual({
      kind: "characterDidThisPhase",
      character: { categories: ["identity"], controlledBy: { kind: "controller" } },
      did: "attack",
    });
    expect(allOf(characterDidThisPhase(yourHero, "attack"), characterDidThisPhase(yourHero, "thwart"))).toEqual({
      kind: "and",
      of: [
        { kind: "characterDidThisPhase", character: yourHero, did: "attack" },
        { kind: "characterDidThisPhase", character: yourHero, did: "thwart" },
      ],
    });
  });

  it("is the condition of a Hero Action that discards its own card, which validates", () => {
    const both = allOf(characterDidThisPhase(yourHero, "attack"), characterDidThisPhase(yourHero, "thwart"));
    const registry = defineAbilities({ "40173.psychic-inertia-action": heroAction({ while: both }, discard(self)) });
    expect(registry["40173.psychic-inertia-action"]).toEqual({
      trigger: { kind: "action", form: "hero", while: both },
      effects: [{ kind: "discardFromPlay", target: { kind: "self" } }],
    });
  });
});
