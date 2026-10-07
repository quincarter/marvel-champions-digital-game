/**
 * docs/phase7-wave7.md §3.56: `deckDiscardIconsCount(you, "wild", 2)`, "When counting resources on cards discarded from
 * the top of your deck, count each printed [wild] icon twice" as a constant on the face that prints it, and the two
 * counts that read it. The engine's `deck-discard-icon-count.test.ts` drives the counting.
 */

import { describe, expect, it } from "vitest";
import { action, constant, deckDiscardIconsCount, discardTopOfDeckCost } from "./abilities.js";
import { validateDefinition } from "./validate.js";
import { totalPrintedResources, you } from "./values.js";

describe("§3.56 an icon counted twice on cards discarded from your deck", () => {
  it("deckDiscardIconsCount is a constant rule naming the player, the icon and how many times it counts", () => {
    const definition = constant(deckDiscardIconsCount(you, "wild", 2));
    expect(definition).toEqual({
      trigger: {
        kind: "constant",
        rules: [{ kind: "deckDiscardIconCount", player: { kind: "controller" }, resource: "wild", times: 2 }],
      },
      effects: [],
    });
    expect(validateDefinition(definition)).toEqual([]);
  });

  it("a cost's discarded cards are counted by totalPrintedResources over its slot, all icons or one type", () => {
    const paid = { kind: "slot", slot: "paid" } as const;
    expect(totalPrintedResources(paid)).toEqual({ kind: "totalPrintedResources", cards: paid });
    expect(totalPrintedResources(paid, ["wild"])).toEqual({
      kind: "totalPrintedResources",
      cards: paid,
      types: ["wild"],
    });
    const definition = {
      ...action({
        kind: "addCounters",
        target: { kind: "self" },
        counterType: "luck",
        amount: totalPrintedResources(paid),
      }),
      cost: discardTopOfDeckCost(1, "paid"),
    };
    expect(definition.cost).toEqual({ discardFromDeck: 1, discardFromDeckSlot: "paid" });
    expect(validateDefinition(definition)).toEqual([]);
  });
});
