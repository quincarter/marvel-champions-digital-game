/**
 * docs/phase7-wave6.md §3.64: the DSL side of "If this card was revealed from the encounter deck, it gains surge" (the
 * SHOW environments, `mojo`). The engine's `revealed-from-encounter-deck.test.ts` drives the behaviour.
 */

import { describe, expect, it } from "vitest";
import { whenRevealed } from "./abilities.js";
import { ifThen, surge } from "./effects.js";
import { validateDefinition } from "./validate.js";
import { revealedFromEncounterDeck } from "./values.js";

describe("§3.64 builders", () => {
  it("revealedFromEncounterDeck is a predicate a When Revealed can branch on", () => {
    const definition = whenRevealed(ifThen(revealedFromEncounterDeck, surge()));
    expect(definition.effects).toEqual([
      { kind: "if", condition: { kind: "revealedFromEncounterDeck" }, then: [{ kind: "gainSurge" }] },
    ]);
    expect(validateDefinition(definition)).toEqual([]);
  });
});
