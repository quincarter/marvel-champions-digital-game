/**
 * Wave 9 trigger patterns: `on.playerCardDiscardedFromPlay({ who, by })`, the in-play half of "When an encounter card
 * effect would discard a card you control" (Front Organization, `aos` 50028; `cardLeavesPlay.by`), and
 * `on.cardYouControlDiscarded({ who, by })`, the whole of it (a hand and a deck too, `cardBeingDiscarded`); and
 * `on.aPlayerIsDealtAnEncounterCard()`, "After a player is dealt an encounter card" (Intelligence, `aos` 50051;
 * `encounterCardDealt`, docs/phase7-wave9.md §3.12). The engine's `leave-play-cause.test.ts` and
 * `encounter-card-dealt.test.ts` drive the plain data.
 */

import { describe, expect, it } from "vitest";
import { discardThis, interrupt, on, response } from "./abilities.js";
import { anyOfCards, dealtEncounterCards, discard, encounterCards, instead, lookAtAndRearrange } from "./effects.js";
import { validateDefinition } from "./validate.js";
import { self } from "./values.js";

describe("`on.playerCardDiscardedFromPlay`", () => {
  it("with no options is any player card leaving play for a player's discard pile, as before", () => {
    expect(on.playerCardDiscardedFromPlay()).toEqual({ on: "cardLeavesPlay", eventIs: { to: "discard" } });
  });
  it("`who` names the card and `by` whose card effect discards it", () => {
    expect(on.playerCardDiscardedFromPlay({ who: { controller: "you", self: false }, by: "encounterCard" })).toEqual({
      on: "cardLeavesPlay",
      targetIs: { controller: "you", self: false },
      eventIs: { to: "discard", by: "encounterCard" },
    });
    expect(on.playerCardDiscardedFromPlay({ by: "playerCard" }).eventIs).toEqual({ to: "discard", by: "playerCard" });
  });
  it("validates as a 'would' replacement", () => {
    const definition = interrupt(
      on.playerCardDiscardedFromPlay({ who: { controller: "you", self: false }, by: "encounterCard" }),
      { would: true },
      instead(discard(self)),
    );
    expect(validateDefinition(definition)).toEqual([]);
  });
});

describe("`on.cardYouControlDiscarded` (docs/phase7-wave9.md §4.1 Q20 = B)", () => {
  it("hears a card in play leaving for a discard pile and a card of a hand or a deck about to be discarded", () => {
    expect(on.cardYouControlDiscarded({ who: { controller: "you", self: false }, by: "encounterCard" })).toEqual({
      on: ["cardLeavesPlay", "cardBeingDiscarded"],
      targetIs: { controller: "you", self: false },
      eventIs: { to: "discard", by: "encounterCard" },
    });
    expect(on.cardYouControlDiscarded()).toEqual({
      on: ["cardLeavesPlay", "cardBeingDiscarded"],
      eventIs: { to: "discard" },
    });
  });
  it("validates as a 'would' replacement, and not as a response (a discard about to happen has no response window)", () => {
    const pattern = on.cardYouControlDiscarded({ who: { controller: "you", self: false }, by: "encounterCard" });
    expect(validateDefinition(interrupt(pattern, { would: true }, instead(discard(self))))).toEqual([]);
    expect(validateDefinition(response(pattern, discard(self))).join("\n")).toMatch(
      /cardBeingDiscarded is interrupt-only/,
    );
  });
});

describe("`on.aPlayerIsDealtAnEncounterCard`", () => {
  it("hears every deal to any player, or only those of the sources named", () => {
    expect(on.aPlayerIsDealtAnEncounterCard()).toEqual({ on: "encounterCardDealt" });
    expect(on.aPlayerIsDealtAnEncounterCard("villainPhase")).toEqual({
      on: "encounterCardDealt",
      eventIs: { source: "villainPhase" },
    });
    expect(on.aPlayerIsDealtAnEncounterCard(["villainPhase", "hazard"]).eventIs).toEqual({
      source: ["villainPhase", "hazard"],
    });
    // The card the surge keyword deals is a deal with its own source (docs/phase7-wave9.md §4.1 Q19 = B).
    expect(on.aPlayerIsDealtAnEncounterCard("surge").eventIs).toEqual({ source: "surge" });
  });
  it("validates with the look-and-swap as its effect and the card's own discard as its cost", () => {
    const definition = response(
      on.aPlayerIsDealtAnEncounterCard(),
      { cost: discardThis },
      lookAtAndRearrange(anyOfCards(dealtEncounterCards(), encounterCards(["deck"], undefined, 1))),
    );
    expect(validateDefinition(definition)).toEqual([]);
  });
});
