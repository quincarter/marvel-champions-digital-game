/**
 * docs/phase7-wave7.md §3.55: `on.thisDiscardedFromYourDeck()` with `inDiscard(...)`, "Response: After this card is
 * discarded from the top of your deck, …" read from the discard pile, and `on.youDiscardFromYourDeck()`, "After you
 * discard a card from the top of your deck" on a card in play. The engine's `card-discarded-from-deck.test.ts` drives
 * the event.
 */

import { describe, expect, it } from "vitest";
import { action, constant, forcedResponse, inDiscard, interrupt, on, response } from "./abilities.js";
import { validateDefinition } from "./validate.js";

const toHand = { kind: "moveCards", cards: { kind: "ref", ref: { kind: "self" } }, to: "hand" } as const;

describe("§3.55 a card discarded from the top of your deck", () => {
  it("thisDiscardedFromYourDeck is the card's own discard; inDiscard marks the response as read from the pile", () => {
    const definition = inDiscard(response(on.thisDiscardedFromYourDeck(), toHand));
    expect(definition).toEqual({
      trigger: { kind: "response", forced: false, on: { on: "cardDiscardedFromDeck", selfIs: "target" } },
      effects: [toHand],
      activeIn: "discard",
    });
    expect(validateDefinition(definition)).toEqual([]);
    expect(validateDefinition(inDiscard(forcedResponse(on.thisDiscardedFromYourDeck(), toHand)))).toEqual([]);
  });

  it("unless: deckReset leaves out a discard whose deck reset has already shuffled the card back (MC40 p. 21)", () => {
    expect(on.thisDiscardedFromYourDeck({ unless: "deckReset" })).toEqual({
      on: "cardDiscardedFromDeck",
      selfIs: "target",
      eventIs: { at: "discard" },
    });
  });

  it("youDiscardFromYourDeck is any card discarded from the controller's deck, heard from play", () => {
    expect(on.youDiscardFromYourDeck()).toEqual({ on: "cardDiscardedFromDeck", playerIs: "controller" });
    expect(validateDefinition(response(on.youDiscardFromYourDeck(), toHand))).toEqual([]);
  });

  it("inDiscard is refused on anything but a free response to the card's own discard from its deck", () => {
    const refused = (definition: Parameters<typeof validateDefinition>[0]) =>
      validateDefinition(definition).filter((problem) => problem.includes("discard pile"));
    expect(refused(inDiscard(response(on.youDiscardFromYourDeck(), toHand)))).toHaveLength(1);
    expect(refused(inDiscard(response(on.thisEntersYourHand(), toHand)))).toHaveLength(1);
    expect(refused(inDiscard(interrupt(on.thisDiscardedFromYourDeck(), toHand)))).toHaveLength(1);
    expect(refused(inDiscard(action(toHand)))).toHaveLength(1);
    expect(refused(inDiscard(constant()))).toHaveLength(1);
    const paid = inDiscard({
      ...response(on.thisDiscardedFromYourDeck(), toHand),
      cost: { exhaustSelf: true },
    });
    expect(refused(paid)).toEqual(["an ability used from the discard pile has no cost"]);
  });
});
