/**
 * docs/phase7-shadowland.md §6 M3: the DSL spelling of a trait-gathered encounter-side deck (the trap deck, MC65
 * pp. 12-13) and of "reveal a card from the trap deck". The rules themselves are tested in `@mc/engine`'s
 * `trap-deck.test.ts`.
 */

import { cardId, encounterSetId, trait } from "@mc/content";
import { describe, expect, it } from "vitest";
import { revealTopOfScenarioDeck, traitEncounterDeck } from "./index.js";

describe("trait encounter deck builders (docs/phase7-shadowland.md §6 M3)", () => {
  it("declares a deck built at setup, routing discards by its trait, reshuffled without penalty", () => {
    const deck = traitEncounterDeck("trap", trait("TRAP!"), {
      wholeEncounterSetIds: [encounterSetId("deadly_contraptions")],
      cardIds: [cardId("whisper")],
    });
    expect(deck).toEqual({
      name: "trap",
      contents: {
        trait: "TRAP!",
        wholeEncounterSetIds: ["deadly_contraptions"],
        cardIds: ["whisper"],
      },
      discardPile: "own",
      whenEmpty: "reshuffleDiscardWithoutPenalty",
      discardByTrait: "TRAP!",
      buildAtSetup: true,
    });
    expect(traitEncounterDeck("trap", trait("TRAP!")).contents).toEqual({ trait: "TRAP!" });
  });

  it("reveals the deck's top card through the reveal procedure", () => {
    expect(revealTopOfScenarioDeck("trap")).toEqual([
      {
        kind: "selectCards",
        slot: "top-of-trap",
        cards: { kind: "scenarioDeck", name: "trap", top: { kind: "const", value: 1 } },
      },
      { kind: "revealCard", cards: { kind: "slot", slot: "top-of-trap" }, player: { kind: "controller" } },
    ]);
  });
});
