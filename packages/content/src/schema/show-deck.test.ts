import { describe, expect, it } from "vitest";
import { cardId, encounterSetId, scenarioId, setCode, trait, validateScenario } from "./index.js";
import type { Scenario, ScenarioSeparateDeck } from "./index.js";
import { MOJO_CARDS } from "../data/mojo/cards.js";
import { MOJO_SCENARIOS } from "../data/mojo/scenarios.js";

/**
 * docs/phase7-wave6.md §3.66: `ScenarioSeparateDeck.contents.cardIds`, `discardPile: "none"` and `closedToPlayerCards`.
 * Sources: Across the Mojoverse 1A (`mojo` 39015a): "Shuffle each other SHOW environment together with the Cornered!
 * treachery to create the show deck."; the MojoMania insert, p. 11: "The show deck has no discard pile and cannot be
 * affected by player card effects."
 */

const SHOW: ScenarioSeparateDeck = {
  name: "show",
  contents: { cardType: "environment", trait: trait("SHOW"), cardIds: [cardId("39017")] },
  discardPile: "none",
  whenEmpty: "remainsEmpty",
  closedToPlayerCards: true,
};
const base: Scenario = {
  id: scenarioId("fixture"),
  name: "Fixture",
  packCode: setCode("mojo"),
  villainCardId: cardId("39012a"),
  mainSchemeCardId: cardId("39015a"),
  encounterSetIds: [encounterSetId("spiral")],
  recommendedModularSetIds: [],
  standardEncounterSetIds: [encounterSetId("standard")],
  expertEncounterSetIds: [encounterSetId("expert")],
  villainStages: { standard: [1, 2], expert: [2, 3] },
  modularSetCount: 3,
};
const errorsOf = (deck: unknown): readonly string[] =>
  validateScenario({ ...base, separateDecks: [deck as ScenarioSeparateDeck] }).errors;

describe("§3.66 a scenario deck with named cards, no discard pile, closed to player cards", () => {
  it("the show deck validates", () => {
    expect(errorsOf(SHOW)).toEqual([]);
  });

  it("card ids alone may name a deck's contents", () => {
    expect(errorsOf({ ...SHOW, contents: { cardIds: [cardId("39017")] } })).toEqual([]);
    expect(errorsOf({ ...SHOW, contents: {} })).toEqual([
      "scenario separate deck show contents must name encounter sets, a card type, a trait, card ids, or several",
    ]);
  });

  it("rejects card ids that are empty, repeated or not a list", () => {
    const message = "scenario separate deck show contents.cardIds must list card ids, each once";
    expect(errorsOf({ ...SHOW, contents: { cardIds: [] } })).toEqual([message]);
    expect(errorsOf({ ...SHOW, contents: { cardIds: [cardId("39017"), cardId("39017")] } })).toEqual([message]);
    expect(errorsOf({ ...SHOW, contents: { cardIds: [""] } })).toEqual([message]);
    expect(errorsOf({ ...SHOW, contents: { cardIds: "39017" } })).toEqual([message]);
  });

  it("a deck with no discard pile has nothing to reshuffle", () => {
    expect(errorsOf({ ...SHOW, whenEmpty: "reshuffleDiscardWithoutPenalty" })).toEqual([
      "scenario separate deck show can only reshuffle a discard pile of its own",
    ]);
    expect(errorsOf({ ...SHOW, discardPile: "nowhere" })).toEqual([
      "scenario separate deck show discardPile must be 'own', 'encounter' or 'none'",
    ]);
  });

  it("closedToPlayerCards is true or absent", () => {
    const { closedToPlayerCards: _closed, ...open } = SHOW;
    expect(errorsOf(open)).toEqual([]);
    expect(errorsOf({ ...SHOW, closedToPlayerCards: false })).toEqual([
      "scenario separate deck show closedToPlayerCards must be true when present",
    ]);
  });
});

describe("§3.66 the ingested Spiral scenario", () => {
  const spiral = MOJO_SCENARIOS.find((scenario) => scenario.id === "spiral")!;

  it("declares the show deck as Across the Mojoverse 1A and the insert (p. 11) state it", () => {
    expect(spiral.separateDecks).toEqual([SHOW]);
    expect(validateScenario(spiral).errors).toEqual([]);
  });

  it("names Cornered!, a Spiral treachery that is not an environment, and the pack prints six SHOW environments", () => {
    const cornered = MOJO_CARDS.find((card) => card.id === "39017")!;
    expect([cornered.name, cornered.type]).toEqual(["Cornered!", "treachery"]);
    const shows = MOJO_CARDS.filter((card) => card.type === "environment" && card.traits.includes(trait("SHOW"))).map(
      (card) => card.id as string,
    );
    expect(shows).toEqual(["39035", "39041", "39047", "39053", "39060", "39066"]);
  });

  it("no other MojoMania scenario has a separate deck", () => {
    expect(MOJO_SCENARIOS.filter((scenario) => scenario.separateDecks).map((scenario) => scenario.id)).toEqual([
      "spiral",
    ]);
  });
});
