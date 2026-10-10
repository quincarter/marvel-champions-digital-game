/**
 * Two wave 9 trigger patterns: `on.playerCardDiscardedFromPlay({ who, by })`, "When an encounter card effect would
 * discard a card you control" (Front Organization, `aos` 50028; `cardLeavesPlay.by`), and
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
