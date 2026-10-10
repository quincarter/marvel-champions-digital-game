import { describe, expect, it } from "vitest";
import {
  action,
  chosen,
  discardTuckedCost,
  draw,
  moveCards,
  cards,
  oncePerRound,
  query,
  validateDefinition,
  yourIdentity,
} from "./index.js";

describe("discardTuckedCost: 'Discard a card tucked here →' (Cindy Moon, silk 52001b; docs/phase7-wave9.md §3.39)", () => {
  it("builds one card tucked under this card by default, bound to `discarded`", () => {
    expect(discardTuckedCost()).toEqual({
      discardTucked: { slot: "discarded", query: {}, under: { kind: "self" }, min: 1, max: 1 },
    });
  });

  it("carries another host, a count range, a filter, a slot and a count var", () => {
    const cost = discardTuckedCost(yourIdentity, {
      min: 1,
      max: "any",
      filter: query("minion"),
      slot: "gone",
      bind: "n",
    });
    expect(cost).toEqual({
      discardTucked: { slot: "gone", query: query("minion"), under: yourIdentity, min: 1, bind: "n" },
    });
    expect(discardTuckedCost(yourIdentity, { min: 2 }).discardTucked).toMatchObject({ min: 2, max: 2 });
  });

  it("validates, and the effects may read the discarded card", () => {
    expect(validateDefinition(action({ cost: discardTuckedCost(), limit: oncePerRound }, draw(2)))).toEqual([]);
    expect(
      validateDefinition(action({ cost: discardTuckedCost() }, moveCards(cards(chosen("discarded")), "deckShuffle"))),
    ).toEqual([]);
  });

  it("refuses a count below 1 (RRG 1.8 'Cost', p. 14), a max below min, and options that read cards in play", () => {
    expect(validateDefinition(action({ cost: discardTuckedCost(undefined, { min: 0 }) }, draw(2)))[0]).toMatch(
      /cost discardTucked: min must be a whole number of at least 1/,
    );
    expect(validateDefinition(action({ cost: discardTuckedCost(undefined, { min: 2, max: 1 }) }, draw(2)))[0]).toMatch(
      /cost discardTucked: max/,
    );
    const each = { discardTucked: { ...discardTuckedCost().discardTucked!, each: true as const } };
    expect(validateDefinition(action({ cost: each }, draw(2))).join("\n")).toMatch(/read cards in play, not tucked/);
  });
});
