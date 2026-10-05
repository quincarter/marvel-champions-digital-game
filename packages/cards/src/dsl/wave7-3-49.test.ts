/**
 * docs/phase7-wave7.md §3.49: the DSL builders for the victory display as a place cards are taken from and sent to.
 * `victoryDisplayCards(filter)` is the `CardSelector`, `addToVictoryDisplay(from)` the `moveCards` to it, and
 * `putIntoPlay` takes a card chosen there as it takes one from any other area. The engine's
 * `victory-display-source-destination.test.ts` drives the compiled effects.
 */

import { describe, expect, it } from "vitest";
import {
  addToVictoryDisplay,
  anyOfCards,
  cards,
  chooseCards,
  moveCards,
  moveThreat,
  putIntoPlay,
  shuffleDeck,
  victoryDisplayCards,
  zone,
} from "./effects.js";
import { chosen, eventTarget, query, self, theMainScheme, you } from "./values.js";

describe("§3.49 the victory display as a source and a destination", () => {
  it("victoryDisplayCards names the shared display, with a filter when one is given", () => {
    expect(victoryDisplayCards()).toEqual({ kind: "victoryDisplay" });
    expect(victoryDisplayCards(query("sideScheme"))).toEqual({
      kind: "victoryDisplay",
      filter: { categories: ["sideScheme"] },
    });
  });

  it("addToVictoryDisplay is a moveCards to the display: 'add [this card] and that side scheme'", () => {
    expect(addToVictoryDisplay(cards(self))).toEqual(moveCards(cards(self), "victoryDisplay"));
    expect(addToVictoryDisplay(cards(eventTarget), "added")).toEqual({
      kind: "moveCards",
      cards: { kind: "ref", ref: { kind: "eventTarget" } },
      to: "victoryDisplay",
      bind: "added",
    });
  });

  it("'put a side scheme from the victory display into play → move 4 threat … to that side scheme'", () => {
    const effects = [
      chooseCards("back", victoryDisplayCards(query("sideScheme")), { min: 1, max: 1 }),
      putIntoPlay(chosen("back")),
      moveThreat(theMainScheme, chosen("back"), { amount: 4 }),
    ];
    expect(effects[0]).toMatchObject({
      kind: "chooseCards",
      slot: "back",
      from: { kind: "victoryDisplay", filter: { categories: ["sideScheme"] } },
      chooser: you,
    });
    expect(effects[1]).toEqual({ kind: "putIntoPlay", card: { kind: "slot", slot: "back" }, controller: you });
  });

  it("a search of deck, discard pile, hand and victory display is one pool, then the deck is shuffled", () => {
    const filter = { name: "The Sought Card" };
    const pool = anyOfCards(zone(["deck", "discard", "hand"], you, { filter }), victoryDisplayCards(filter));
    expect(pool).toEqual({
      kind: "anyOf",
      of: [
        { kind: "zone", zone: ["deck", "discard", "hand"], player: you, filter },
        { kind: "victoryDisplay", filter },
      ],
    });
    expect(shuffleDeck()).toEqual({ kind: "shuffleDeck", player: you });
  });
});
