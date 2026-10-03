/**
 * docs/phase7-wave6.md §3.60: the DSL side of "After the encounter deck resets" (Wheel of Genres, Spinning, `mojo`
 * 39026a). `on.encounterDeckResets` hears the engine's `deckRanOut { deck: "encounter", deckId }`, announced once the
 * emptied deck has been reshuffled and its acceleration token placed (RRG 1.8 "Encounter Deck", p. 17). The engine's
 * `encounter-deck-reset.test.ts` drives the same trigger shape.
 */

import { describe, expect, it } from "vitest";
import { forcedResponse, on } from "./abilities.js";
import { flipCard } from "./effects.js";
import { validateDefinition } from "./validate.js";
import { self } from "./values.js";

describe("§3.60 on.encounterDeckResets", () => {
  it("hears any encounter deck's reset, and neither a player's deck nor a scenario deck", () => {
    expect(on.encounterDeckResets()).toEqual({ on: "deckRanOut", eventIs: { deck: "encounter" } });
    expect(on.encounterDeckResets()).not.toEqual(on.aPlayerResetsTheirDeck());
    expect(on.encounterDeckResets()).not.toEqual(on.scenarioDeckRunsOut("show"));
  });

  it("narrows to one villain's deck where a scenario has several (The Wrecking Crew)", () => {
    expect(on.encounterDeckResets("deck-2")).toEqual({
      on: "deckRanOut",
      eventIs: { deck: "encounter", deckId: "deck-2" },
    });
  });

  it("Wheel of Genres: a Forced Response to the reset that flips this card", () => {
    const definition = forcedResponse(on.encounterDeckResets(), flipCard(self));
    expect(validateDefinition(definition)).toEqual([]);
    expect(definition.trigger).toEqual({
      kind: "response",
      forced: true,
      on: { on: "deckRanOut", eventIs: { deck: "encounter" } },
    });
    expect(definition.effects).toEqual([{ kind: "flipCard", target: { kind: "self" } }]);
  });
});
