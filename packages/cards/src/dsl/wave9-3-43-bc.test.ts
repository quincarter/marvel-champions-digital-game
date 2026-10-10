/**
 * docs/phase7-wave9.md §3.43 (b) and (c): `on.discardedFromEncounterDeck` ("After a Serpent Society minion is
 * discarded from the top of the encounter deck", Serpent Solutions 53031) and `on.youResolveAbility` with the resolved
 * ability's slots as `moment.<slot>` ("After you resolve Falcon's 'Eagle-Eyed' ability, … for each icon in the
 * discarded card's boost area", Talon Line 53012). The engine's `encounter-deck-discard-event.test.ts` drives them.
 */

import { trait } from "@mc/content";
import { describe, expect, it } from "vitest";
import {
  action,
  discardThis,
  discardTopOfEncounterDeckCost,
  forcedInterrupt,
  forcedResponse,
  inDiscard,
  on,
  response,
} from "./abilities.js";
import { dealAsEncounterCard, dealDamage, draw, repeatTimes } from "./effects.js";
import { validateDefinition } from "./validate.js";
import {
  boostAreaIconsOn,
  chosen,
  eventTarget,
  firstPlayer,
  query,
  starIconsOn,
  theVillain,
  valueAtLeast,
  varOf,
} from "./values.js";

const SERPENT_SOCIETY = trait("SERPENT SOCIETY");

describe("§3.43 (b) on.discardedFromEncounterDeck", () => {
  it("any card: the encounter deck is asked for by name", () => {
    expect(on.discardedFromEncounterDeck()).toEqual({ on: "cardDiscardedFromDeck", eventIs: { deck: "encounter" } });
  });

  it("narrows the discarded card and the cause", () => {
    expect(
      on.discardedFromEncounterDeck(query("minion", { trait: SERPENT_SOCIETY }), { how: "cost", by: "playerCard" }),
    ).toEqual({
      on: "cardDiscardedFromDeck",
      targetIs: { categories: ["minion"], trait: SERPENT_SOCIETY },
      eventIs: { deck: "encounter", how: "cost", by: "playerCard" },
    });
  });

  it("Serpent Solutions' shape validates", () => {
    const solutions = forcedResponse(
      on.discardedFromEncounterDeck(query("minion", { trait: SERPENT_SOCIETY })),
      dealAsEncounterCard(eventTarget, firstPlayer),
    );
    expect(solutions.trigger).toMatchObject({ kind: "response", forced: true });
    expect(validateDefinition(solutions)).toEqual([]);
  });

  it("refuses an interrupt, playerIs and a card answering from the discard pile", () => {
    const pattern = on.discardedFromEncounterDeck();
    expect(validateDefinition(forcedInterrupt(pattern, draw(1)))).toContainEqual(
      expect.stringContaining("is a response"),
    );
    expect(validateDefinition(forcedResponse({ ...pattern, playerIs: "controller" }, draw(1)))).toContainEqual(
      expect.stringContaining("cannot ask playerIs"),
    );
    expect(validateDefinition(inDiscard(response({ ...pattern, selfIs: "target" }, draw(1))))).toContainEqual(
      expect.stringContaining("is heard by a card in play"),
    );
  });

  it("a player deck's patterns are untouched", () => {
    expect(on.youDiscardFromYourDeck()).toEqual({ on: "cardDiscardedFromDeck", playerIs: "controller" });
    expect(validateDefinition(inDiscard(response(on.thisDiscardedFromYourDeck(), draw(1))))).toEqual([]);
  });
});

describe("§3.43 (c) on.youResolveAbility and the resolved ability's slots", () => {
  const EAGLE_EYED = "53001a.eagle-eyed-action";

  it("names the ability by id, resolved by you", () => {
    expect(on.youResolveAbility(EAGLE_EYED)).toEqual({
      on: "abilityResolved",
      playerIs: "controller",
      eventIs: { abilityId: EAGLE_EYED },
    });
  });

  it("the icon readers: a star apart from the boost icons, and both", () => {
    expect(starIconsOn(chosen("moment.discarded"))).toEqual({
      kind: "starIcons",
      cards: { kind: "slot", slot: "moment.discarded" },
    });
    expect(boostAreaIconsOn(eventTarget)).toEqual({
      kind: "sum",
      values: [
        { kind: "boostIcons", of: { kind: "eventTarget" } },
        { kind: "starIcons", cards: { kind: "eventTarget" } },
      ],
    });
  });

  it("Talon Line's shape reads the slot the resolved ability's cost bound", () => {
    const icons = boostAreaIconsOn(chosen("moment.discarded"));
    const talon = response(
      on.youResolveAbility(EAGLE_EYED),
      { cost: discardThis, while: valueAtLeast(icons, 1) },
      repeatTimes(icons, dealDamage(1, theVillain)),
    );
    expect(validateDefinition(talon)).toEqual([]);
  });

  it("the slot is not readable by an ability that answers nothing of the kind", () => {
    const eagle = action(
      { cost: discardTopOfEncounterDeckCost("discarded") },
      dealDamage(varOf("discarded.boostIcons"), theVillain),
    );
    expect(validateDefinition(eagle)).toEqual([]);
    expect(
      validateDefinition(action(dealDamage(boostAreaIconsOn(chosen("moment.discarded")), theVillain))),
    ).not.toEqual([]);
  });
});
