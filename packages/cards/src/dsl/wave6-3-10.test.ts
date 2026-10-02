/**
 * docs/phase7-wave6.md §3.10: encounter treacheries that stay in a player's hand (Infiltration, Shapeshifter Surprise,
 * `mut_gen` 32082-32083; MC32 p. 7). The builders validate and emit the plain data
 * `encounter-card-stays-in-hand.test.ts` (engine) drives.
 */

import { describe, expect, it } from "vitest";
import { constant, forcedResponse, inHand, on, staysInHand } from "./abilities.js";
import { draw } from "./effects.js";
import { validateDefinition } from "./validate.js";

describe("§3.10 'After this card enters your hand'", () => {
  it("inHand(constant(staysInHand())) is the card's own rule, matched against itself", () => {
    const definition = inHand(constant(staysInHand()));
    expect(validateDefinition(definition)).toEqual([]);
    expect(definition).toMatchObject({
      activeIn: "hand",
      trigger: { kind: "constant", rules: [{ kind: "staysInHand", cards: {} }] },
    });
  });

  it("constant(staysInHand(query)) is a scenario rule naming the cards", () => {
    const definition = constant(staysInHand({ name: "Infiltration" }));
    expect(validateDefinition(definition)).toEqual([]);
    expect(definition.trigger).toEqual({
      kind: "constant",
      rules: [{ kind: "staysInHand", cards: { name: "Infiltration" } }],
    });
  });

  it("on.thisEntersYourHand() is the card's own draw from a player's deck, usable from hand", () => {
    expect(on.thisEntersYourHand()).toEqual({
      on: "encounterCardFromPlayerDeck",
      selfIs: "target",
      eventIs: { how: "draw" },
    });
    const definition = inHand(forcedResponse(on.thisEntersYourHand(), draw(1)));
    expect(validateDefinition(definition)).toEqual([]);
    expect(definition).toMatchObject({ activeIn: "hand", trigger: { kind: "response", forced: true } });
  });
});
