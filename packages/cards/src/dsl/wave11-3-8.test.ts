/**
 * docs/phase7-wave11.md §3.8: `playableTucked`, the DSL part of "You may play the upgrade tucked here as if it were in
 * your hand." (Contingency Planning, `fne` 60030), which emits the engine's `playableAsIfInHand { zone: { tuckedUnder }
 * }`. The engine's behavior is proven in `packages/engine/src/playable-tucked.test.ts`; this file proves what the
 * builder emits and what validates.
 */

import { describe, expect, it } from "vitest";
import { constant, playableTopOfDeck, playableTucked } from "./abilities.js";
import { validateDefinition } from "./validate.js";

describe("§3.8 playableTucked", () => {
  it("emits the permission over the cards tucked under this card, filtered to upgrades", () => {
    const definition = constant(playableTucked({ cards: { categories: ["upgrade"] } }));
    expect(definition).toEqual({
      trigger: {
        kind: "constant",
        playableAsIfInHand: {
          player: { kind: "controller" },
          zone: { tuckedUnder: { kind: "self" } },
          cards: { categories: ["upgrade"] },
        },
      },
      effects: [],
    });
    expect(validateDefinition(definition)).toEqual([]);
  });

  it("a reduction and a limit are carried as for playableTopOfDeck, the limit as the ability's own", () => {
    const definition = constant(playableTucked({ costReduction: 2, limit: "round" }));
    expect(definition).toMatchObject({
      trigger: { playableAsIfInHand: { costReduction: 2 } },
      limit: { count: 1, period: "round" },
    });
    expect(validateDefinition(definition)).toEqual([]);
  });

  it("control: one permission per constant", () => {
    expect(() => constant(playableTucked(), playableTopOfDeck())).toThrow(
      "at most one playableTopOfDeck or playableTucked",
    );
    expect(() => constant(playableTucked(), playableTucked())).toThrow(
      "at most one playableTopOfDeck or playableTucked",
    );
    expect(
      validateDefinition({
        trigger: {
          kind: "constant",
          playableTopOfDeck: { player: { kind: "controller" } },
          playableAsIfInHand: { player: { kind: "controller" }, zone: "deckTop" },
        },
        effects: [],
      }),
    ).toContain("a constant ability has at most one of playableTopOfDeck and playableAsIfInHand");
  });
});
