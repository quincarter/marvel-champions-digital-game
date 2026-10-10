/**
 * docs/phase7-wave9.md §3.17: the Holding Cell's "Forced Interrupt: When the last lock counter is removed from here,
 * flip this card and put Flying Inhuman into play under any player's control" (`aos` 50105a) with
 * `flipCard(target, { controller })`, and the Inhuman allies' "flip it and place it on the bottom of the Holding Cell
 * deck" with `toScenarioDeck(name, "bottom")`. The engine's `scenario-deck-top-in-play.test.ts` drives the behavior.
 */

import { describe, expect, it } from "vitest";
import { after, forcedInterrupt, forcedResponse, when } from "./abilities.js";
import { cards, choosePlayer, flipCard, moveCards, toScenarioDeck } from "./effects.js";
import { validateDefinition } from "./validate.js";
import { chosenPlayer, firstPlayer, self } from "./values.js";

describe("§3.17 flipCard with a controller for the new face", () => {
  it("a plain flip compiles as before, with no controller field", () => {
    expect(flipCard(self)).toEqual({ kind: "flipCard", target: { kind: "self" } });
  });

  it("'put [its other face] into play under any player's control' names the player", () => {
    expect(flipCard(self, { controller: chosenPlayer("freer") })).toEqual({
      kind: "flipCard",
      target: { kind: "self" },
      controller: { kind: "slot", slot: "freer" },
    });
  });

  it("the Holding Cell's forced interrupt validates: the first player chooses, then the card flips to that player", () => {
    const definition = forcedInterrupt(
      when.lastCounterRemoved("lock"),
      choosePlayer("freer", firstPlayer),
      flipCard(self, { controller: chosenPlayer("freer") }),
    );
    expect(validateDefinition(definition)).toEqual([]);
    expect(definition.effects.at(-1)).toEqual({
      kind: "flipCard",
      target: { kind: "self" },
      controller: { kind: "slot", slot: "freer" },
    });
  });

  it("a controller slot nothing bound is refused", () => {
    const definition = forcedInterrupt(
      when.lastCounterRemoved("lock"),
      flipCard(self, { controller: chosenPlayer("nobody") }),
    );
    expect(validateDefinition(definition)).not.toEqual([]);
  });

  it("the ally's forced response validates: itself, to the bottom of the named deck", () => {
    const definition = forcedResponse(
      after.leavesPlay("self"),
      moveCards(cards(self), toScenarioDeck("Holding Cell", "bottom")),
    );
    expect(validateDefinition(definition)).toEqual([]);
    expect(definition.effects).toEqual([
      {
        kind: "moveCards",
        cards: { kind: "ref", ref: { kind: "self" } },
        to: { scenarioDeck: "Holding Cell", at: "bottom" },
      },
    ]);
  });
});
