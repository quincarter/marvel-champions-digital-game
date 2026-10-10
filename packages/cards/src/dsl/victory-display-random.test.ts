import { trait } from "@mc/content";
import { describe, expect, it } from "vitest";
import { chosen, query, revealCard, selectCards, victoryDisplayCards, whenRevealed, you } from "./index.js";
import { validateDefinition } from "./validate.js";

/** `victoryDisplayCards(filter, { random })`: a pick at random among the cards in the victory display. */
describe("victoryDisplayCards: a random pick from the victory display", () => {
  const BOLTS = query("minion", { trait: trait("BOLT") });

  it("with no options it is the plain selector, as before", () => {
    expect(victoryDisplayCards()).toEqual({ kind: "victoryDisplay" });
    expect(victoryDisplayCards(BOLTS)).toEqual({ kind: "victoryDisplay", filter: BOLTS });
  });

  it("random is emitted as given, with and without a filter", () => {
    expect(victoryDisplayCards(undefined, { random: 1 })).toEqual({
      kind: "victoryDisplay",
      random: { kind: "const", value: 1 },
    });
    expect(victoryDisplayCards(BOLTS, { random: 2 })).toEqual({
      kind: "victoryDisplay",
      filter: BOLTS,
      random: { kind: "const", value: 2 },
    });
  });

  it("validates bound for a reveal: 'choose a random [trait] minion from the victory display and reveal it'", () => {
    const definition = whenRevealed(
      selectCards("minion", victoryDisplayCards(BOLTS, { random: 1 })),
      revealCard(chosen("minion"), you),
    );
    expect(validateDefinition(definition)).toEqual([]);
  });

  it.each([0, -1, 1.5])("a constant random count of %s is rejected", (count) => {
    const bad = whenRevealed(selectCards("minion", victoryDisplayCards(BOLTS, { random: count })));
    expect(validateDefinition(bad).join("\n")).toContain(
      "a victoryDisplay selector's random count must be a whole number of at least 1",
    );
  });
});
