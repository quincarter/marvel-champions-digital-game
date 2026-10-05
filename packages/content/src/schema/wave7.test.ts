import { describe, expect, it } from "vitest";
import {
  cardId,
  cycleId,
  encounterSetId,
  scenarioId,
  setCode,
  unerrataedText,
  validateCard,
  validateScenario,
} from "./index.js";
import type { EventCard, HeroIdentityCard, Scenario } from "./index.js";

/**
 * docs/phase7-wave7.md §1.3: a per player icon on a printed cost (`CostedCard.costPerPlayer`). The fixture copies Team
 * Investigation's (40053) printed values, trimmed to what the rule needs; it is not curated data.
 *
 * Sources: RRG 1.8 "Per Player Icon" (p. 32); MC40 p. 5.
 */

const teamInvestigation: EventCard = {
  id: cardId("40053"),
  type: "event",
  name: "Team Investigation",
  setCode: setCode("next_evol"),
  cycleId: cycleId("cycle7"),
  collectorNumber: "53",
  quantityInSet: 3,
  unique: false,
  cost: 2,
  costPerPlayer: true,
  resourceIcons: { mental: 1 },
  aspect: "justice",
  traits: [],
  keywords: [{ name: "alliance" }],
  deckLimit: 3,
  text: unerrataedText("Alliance.\nHero Action: Remove 3[per_hero] threat from a side scheme."),
  abilities: [],
};

describe("§1.3 CostedCard.costPerPlayer", () => {
  it("a cost of 2 per player is the numeral 2 with the flag", () => {
    expect(validateCard(teamInvestigation).errors).toEqual([]);
    const { costPerPlayer: _dropped, ...flatCost } = teamInvestigation;
    expect(validateCard(flatCost).errors).toEqual([]);
  });

  it("is true or absent, never false or a number", () => {
    for (const value of [false, 1, "true"]) {
      const card = { ...teamInvestigation, costPerPlayer: value } as unknown as EventCard;
      expect(validateCard(card).errors).toContain("event costPerPlayer must be true when present");
    }
  });

  it("does not go with a printed X or — cost, which has no numeral to multiply", () => {
    for (const specialCost of ["X", "dash"] as const) {
      const card: EventCard = { ...teamInvestigation, cost: 0, specialCost };
      expect(validateCard(card).errors).toContain("event costPerPlayer needs a printed number, not a printed X or —");
    }
  });
});

/**
 * docs/phase7-wave7.md §1.21: `Scenario.startingVillain: "bySetup"`. The fixture copies On the Run's record, trimmed to
 * two villains; it is not curated data. Sources: MC40 p. 11; Gotta Get Away 1A (40103a) Setup.
 */
describe("§1.21 Scenario.startingVillain 'bySetup'", () => {
  const onTheRun: Scenario = {
    id: scenarioId("on-the-run"),
    name: "On the Run",
    packCode: setCode("next_evol"),
    villainCardId: cardId("40070a"),
    mainSchemeCardId: cardId("40103a"),
    encounterSetIds: [encounterSetId("on_the_run"), encounterSetId("marauders")],
    recommendedModularSetIds: [encounterSetId("military_grade")],
    standardEncounterSetIds: [encounterSetId("standard")],
    expertEncounterSetIds: [encounterSetId("expert")],
    villainStages: { standard: [1, 1], expert: [1, 1] },
    modularSetCount: 1,
    setAsideVillainCardIds: [cardId("40071a")],
    expertVillains: { villainCardId: cardId("40070b"), setAsideVillainCardIds: [cardId("40071b")] },
    victory: "cardAbility",
    startingVillain: "bySetup",
  };

  it("validates, with several villains to choose among or with one", () => {
    expect(validateScenario(onTheRun).errors).toEqual([]);
    const { setAsideVillainCardIds: _none, expertVillains: _expert, ...single } = onTheRun;
    expect(validateScenario(single).errors).toEqual([]);
  });

  it("'random' still needs villains to choose among, and any other value is refused", () => {
    const { setAsideVillainCardIds: _none, ...single } = onTheRun;
    expect(validateScenario({ ...single, startingVillain: "random" }).errors).toContain(
      "scenario startingVillain 'random' needs setAsideVillainCardIds to choose among",
    );
    const other = { ...onTheRun, startingVillain: "byMainScheme" } as unknown as Scenario;
    expect(validateScenario(other).errors).toContain("scenario startingVillain must be 'random' or 'bySetup'");
  });

  it("is not defined with multipleVillains, which sets its villains aside its own way", () => {
    const { expertVillains: _expert, setAsideVillainCardIds: _aside, ...rest } = onTheRun;
    const several: Scenario = {
      ...rest,
      encounterSetIds: [],
      multipleVillains: {
        villains: [
          { villainCardId: cardId("40070a"), encounterSetIds: [encounterSetId("on_the_run")] },
          { villainCardId: cardId("40071a"), encounterSetIds: [encounterSetId("marauders")] },
        ],
        encounterDecks: "shared",
        activation: "activeVillainOnly",
        winCondition: "cardAbility",
        atSetup: "setAside",
      },
    };
    expect(validateScenario(several).errors).toContain(
      "scenario startingVillain is not defined for a scenario with multipleVillains",
    );
  });
});

/**
 * docs/phase7-wave7.md §3.63: a scheme icon printed on one identity face (`HeroFace.schemeIcons`). The fixture copies
 * Angel's (42001a/b/c) printed values, trimmed to what the rule needs; it is not curated data.
 *
 * Sources: scan 42001c (Archangel prints an acceleration icon in his text box; 42001a and 42001b print none); RRG 1.8
 * "Acceleration Icon" (p. 5).
 */
describe("§3.63 scheme icons on an identity face", () => {
  const angelFace = {
    faceName: "Angel",
    traits: [],
    atk: 1,
    thw: 2,
    def: 2,
    handSize: 5,
    keywords: [],
    text: unerrataedText("Angel of Life — Response: After you play an AERIAL event, draw 1 card."),
    abilities: [],
  };
  const angel: HeroIdentityCard = {
    id: cardId("42001a"),
    type: "hero_identity",
    name: "Angel",
    setCode: setCode("angel"),
    cycleId: cycleId("cycle7"),
    collectorNumber: "1",
    quantityInSet: 1,
    unique: true,
    hp: 12,
    hero: angelFace,
    alterEgo: {
      faceName: "Warren Worthington III",
      traits: [],
      rec: 3,
      handSize: 6,
      keywords: [],
      text: unerrataedText("Regrowth — Action: Heal 1 damage from Warren Worthington III."),
      abilities: [],
    },
    obligationCardId: cardId("42024"),
    nemesisEncounterSetId: encounterSetId("angel_nemesis"),
    additionalHeroForms: [
      {
        ...angelFace,
        faceName: "Archangel",
        atk: 3,
        thw: 1,
        def: 1,
        text: unerrataedText("Angel of Death — Response: After you play an AERIAL event, deal damage to an enemy."),
        schemeIcons: ["acceleration"],
      },
    ],
  };
  const [archangel] = angel.additionalHeroForms ?? [];
  if (!archangel) throw new Error("fixture lost its second hero face");

  it("accepts an icon on one hero face, and on the first hero face or the alter-ego face", () => {
    expect(validateCard(angel).errors).toEqual([]);
    expect(validateCard({ ...angel, hero: { ...angel.hero, schemeIcons: ["hazard"] } }).errors).toEqual([]);
    expect(validateCard({ ...angel, alterEgo: { ...angel.alterEgo, schemeIcons: ["crisis"] } }).errors).toEqual([]);
  });

  it("rejects an empty list and an icon that is not a scheme icon, naming the face", () => {
    expect(validateCard({ ...angel, additionalHeroForms: [{ ...archangel, schemeIcons: [] }] }).errors).toContain(
      "additional hero form 1 schemeIcons is omitted rather than empty",
    );
    const amplify = ["amplify"] as unknown as readonly "hazard"[];
    expect(validateCard({ ...angel, hero: { ...angel.hero, schemeIcons: amplify } }).errors).toContain(
      "hero face schemeIcons may only hold crisis, hazard or acceleration",
    );
    expect(validateCard({ ...angel, alterEgo: { ...angel.alterEgo, schemeIcons: amplify } }).errors).toContain(
      "alterEgo face schemeIcons may only hold crisis, hazard or acceleration",
    );
  });
});
