/**
 * docs/phase7-wave7.md §3.33: "Choose a card type, then discard each card from your hand that is not of that type.
 * Draw up to your hand size. Place 1 threat on the main scheme for each card of the chosen type in your hand."
 * `chooseCardType` emits `EffectSpec chooseCardType`; `ofChosenCardType` / `notOfChosenCardType` emit the `TargetQuery
 * cardTypeIs` clause that reads it (`choose-card-type.test.ts` in the engine drives them).
 */

import { describe, expect, it } from "vitest";
import { whenRevealed } from "./abilities.js";
import { chooseCardType, drawUpTo, forEachPlayer, moveCards, placeThreat, zone } from "./effects.js";
import { validateDefinition } from "./validate.js";
import {
  eachPlayer,
  handCountOf,
  handSizeOf,
  notOfChosenCardType,
  ofChosenCardType,
  thatPlayer,
  theMainScheme,
  you,
} from "./values.js";

describe("§3.33 choose a card type", () => {
  it("defaults to you and takes any player", () => {
    expect(chooseCardType("type")).toEqual({ kind: "chooseCardType", player: you, bind: "type" });
    expect(chooseCardType("type", thatPlayer)).toEqual({ kind: "chooseCardType", player: thatPlayer, bind: "type" });
  });

  it("'of that type' and 'not of that type' read the bound choice", () => {
    expect(ofChosenCardType("type")).toEqual({ cardTypeIs: { chosen: "type" } });
    expect(notOfChosenCardType("type")).toEqual({ not: { cardTypeIs: { chosen: "type" } } });
  });

  it("the printed sentence validates and compiles to the four effects in order", () => {
    const definition = whenRevealed(
      chooseCardType("type"),
      moveCards(zone("hand", you, { filter: notOfChosenCardType("type") }), "discard"),
      drawUpTo(handSizeOf()),
      placeThreat(handCountOf(you, ofChosenCardType("type")), theMainScheme),
    );
    expect(validateDefinition(definition)).toEqual([]);
    expect(definition.effects).toEqual([
      { kind: "chooseCardType", player: you, bind: "type" },
      {
        kind: "moveCards",
        cards: { kind: "zone", zone: "hand", player: you, filter: { not: { cardTypeIs: { chosen: "type" } } } },
        to: "discard",
      },
      { kind: "drawUpTo", player: you, amount: { kind: "handSize", player: you } },
      {
        kind: "placeThreat",
        target: theMainScheme,
        amount: { kind: "handCount", player: you, filter: { cardTypeIs: { chosen: "type" } } },
      },
    ]);
  });

  it("'each player chooses a card type': the choice is bound inside each player's pass", () => {
    const definition = whenRevealed(
      forEachPlayer(
        eachPlayer,
        chooseCardType("type", thatPlayer),
        placeThreat(handCountOf(thatPlayer, ofChosenCardType("type")), theMainScheme),
      ),
    );
    expect(validateDefinition(definition)).toEqual([]);
  });

  it("a type read before it is chosen is a validation problem: unbound, 'not of that type' would match every card", () => {
    const unbound = whenRevealed(moveCards(zone("hand", you, { filter: notOfChosenCardType("type") }), "discard"));
    expect(validateDefinition(unbound)).toEqual([
      expect.stringContaining('card type "type" is read before it is chosen'),
    ]);
    const otherName = whenRevealed(
      chooseCardType("type"),
      placeThreat(handCountOf(you, ofChosenCardType("kind")), theMainScheme),
    );
    expect(validateDefinition(otherName)).toEqual([
      expect.stringContaining('card type "kind" is read before it is chosen'),
    ]);
  });
});
