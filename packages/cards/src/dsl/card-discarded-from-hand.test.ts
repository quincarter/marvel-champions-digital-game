/**
 * `on.cardDiscardedFromHand` (issue #922): "After a card is discarded [from a hand] by an ability", the hand's
 * counterpart of `on.youDiscardFromYourDeck`. The engine's `hand-discard-event.test.ts` drives the plain data.
 */

import { describe, expect, it } from "vitest";
import { interrupt, on, response } from "./abilities.js";
import { discard } from "./effects.js";
import { validateDefinition } from "./validate.js";
import { self } from "./values.js";

describe("`on.cardDiscardedFromHand`", () => {
  it("with no options hears every card an ability discards from any hand", () => {
    expect(on.cardDiscardedFromHand()).toEqual({ on: "cardDiscardedFromHand" });
  });
  it("narrows by the card, the discarding card's side, effect or cost, and your hand", () => {
    expect(
      on.cardDiscardedFromHand({ card: { controller: "you" }, by: "encounterCard", how: "effect", yours: true }),
    ).toEqual({
      on: "cardDiscardedFromHand",
      playerIs: "controller",
      targetIs: { controller: "you" },
      eventIs: { by: "encounterCard", how: "effect" },
    });
  });
  it("validates as a response, and not as an interrupt (the card is already in the discard pile)", () => {
    expect(validateDefinition(response(on.cardDiscardedFromHand(), discard(self)))).toEqual([]);
    expect(validateDefinition(interrupt(on.cardDiscardedFromHand(), discard(self))).join("\n")).toMatch(
      /cardDiscardedFromHand is response-only/,
    );
  });
});
