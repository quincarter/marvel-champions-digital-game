/**
 * docs/phase7-wave11.md §3.9: `playableTucked`'s `form` and `discardSelfFromHand`, the DSL part of "If you are in hero
 * form, you can discard Photographic Reflexes from your hand to play an event tucked under Echo as if it were in your
 * hand. Reduce the cost to play that event by 2." (`fne` 60040a/b/c). The engine's behavior is proven in
 * `packages/engine/src/playable-tucked-from-hand.test.ts`; this file proves what the builder emits and what validates.
 */

import { describe, expect, it } from "vitest";
import { constant, inHand, playableTucked } from "./abilities.js";
import { validateDefinition } from "./validate.js";

const REFLEXES = {
  under: { kind: "identityOf", player: { kind: "controller" } },
  cards: { categories: ["event"] },
  costReduction: 2,
  form: "hero",
  discardSelfFromHand: true,
} as const;

describe("§3.9 playableTucked from the hand", () => {
  it("emits the form and the discard-self cost on a constant that works from the hand", () => {
    const definition = inHand(constant(playableTucked(REFLEXES)));
    expect(definition).toEqual({
      activeIn: "hand",
      trigger: {
        kind: "constant",
        playableAsIfInHand: {
          player: { kind: "controller" },
          zone: { tuckedUnder: { kind: "identityOf", player: { kind: "controller" } } },
          cards: { categories: ["event"] },
          costReduction: 2,
          form: "hero",
          discardSelfFromHand: true,
        },
      },
      effects: [],
    });
    expect(validateDefinition(definition)).toEqual([]);
  });

  it("control: discarding its own card from hand needs the ability to work from the hand", () => {
    expect(validateDefinition(constant(playableTucked(REFLEXES)))).toContain(
      "a playableAsIfInHand that discards its own card from hand works from the hand (activeIn: hand)",
    );
  });
});
