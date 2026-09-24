import { describe, expect, it } from "vitest";
import {
  cardId,
  cycleId,
  encounterSetId,
  flat,
  perPlayerOnly,
  scenarioId,
  setCode,
  trait,
  unerrataedText,
  validateCard,
  validateEncounterSet,
  validateScenario,
  validateScenarioEncounterSets,
} from "./index.js";
import type {
  AllyCard,
  EncounterSet,
  EnvironmentCard,
  HeroIdentityCard,
  MainSchemeCard,
  MainSchemeStage,
  Scenario,
  SideSchemeCard,
  UpgradeCard,
} from "./index.js";

/**
 * docs/phase7-wave4.md §1: the schema cycle 3 (The Mad Titan's Shadow, Nebula, War Machine, The Hood, Vision, Valkyrie)
 * needs. Fixtures copy the MarvelCDB records' codes and printed values, trimmed to what each rule needs; they are not
 * curated data.
 *
 * Sources: RRG 1.8 "Form, Change Form" (p. 21), "Flip" (p. 20), "Double-Sided Card" (p. 17), "Standard Set" (p. 40),
 * "Expert Set" (p. 19); The Mad Titan's Shadow rulebook (MC21) pp. 3, 10, 16, 24; The Hood's Making Connections 1A.
 */

const CYCLE = cycleId("cycle4");
const text = unerrataedText;

const upgrade = (fields: Partial<UpgradeCard> & Pick<UpgradeCard, "id" | "name">): UpgradeCard => ({
  type: "upgrade",
  setCode: setCode("mts"),
  cycleId: CYCLE,
  collectorNumber: fields.id.slice(-2),
  quantityInSet: 1,
  unique: false,
  cost: 0,
  resourceIcons: {},
  aspect: "hero:21001a",
  traits: [],
  keywords: [],
  deckLimit: 1,
  text: text("Energy form. Permanent."),
  abilities: [],
  ...fields,
});

const sideScheme = (fields: Partial<SideSchemeCard> & Pick<SideSchemeCard, "id" | "name">): SideSchemeCard => ({
  type: "side_scheme",
  setCode: setCode("mts"),
  cycleId: CYCLE,
  collectorNumber: fields.id.slice(2),
  quantityInSet: 1,
  unique: false,
  encounterSetIds: [encounterSetId("mts_campaign")],
  startingThreat: flat(2),
  icons: [],
  boostIcons: 0,
  traits: [],
  keywords: [{ name: "hinder", value: 0, perPlayer: 1 }],
  text: text("Hinder 1[per_hero]. When Defeated: Flip this card over."),
  abilities: [],
  ...fields,
});

describe("§1.1 the form keyword", () => {
  it("'Energy form.' is a keyword with a lower-case type", () => {
    const gamma = upgrade({
      id: cardId("21002"),
      name: "Gamma",
      specialCost: "dash",
      keywords: [{ name: "form", formType: "energy" }, { name: "permanent" }],
    });
    expect(validateCard(gamma).errors).toEqual([]);
    const shouted = { ...gamma, keywords: [{ name: "form" as const, formType: "Energy" }] };
    expect(validateCard(shouted).errors).toContain("upgrade form keyword needs a lower-case formType");
    const missing = { ...gamma, keywords: [{ name: "form" as const, formType: "" }] };
    expect(validateCard(missing).errors).toContain("upgrade form keyword needs a lower-case formType");
  });

  it("§1.2 a double-sided mass form upgrade carries the keyword on both faces (Intangible / Dense)", () => {
    const intangible = upgrade({
      id: cardId("26002"),
      name: "Intangible",
      setCode: setCode("vision"),
      aspect: "hero:26001a",
      keywords: [{ name: "form", formType: "mass" }, { name: "permanent" }],
      text: text("Mass form. Permanent.\nVision cannot attack or defend."),
      abilities: [{ id: "26002.intangible-constant" as never }],
      flipSide: {
        name: "Dense",
        traits: [],
        keywords: [{ name: "form", formType: "mass" }, { name: "permanent" }],
        text: text("Mass form. Permanent.\nWhile in hero form, Vision gets +2 ATK and +2 DEF."),
        abilities: [{ id: "26002b.dense-constant" as never }],
      },
    });
    expect(validateCard(intangible).errors).toEqual([]);
  });
});

describe("§1.4 Adam Warlock's copy limit", () => {
  const warlock = {
    id: cardId("21031a"),
    type: "hero_identity",
    name: "Adam Warlock",
    setCode: setCode("mts"),
    cycleId: CYCLE,
    collectorNumber: "31A",
    quantityInSet: 1,
    unique: true,
    hp: 11,
    hero: {
      faceName: "Adam Warlock",
      atk: 1,
      thw: 1,
      def: 2,
      handSize: 5,
      keywords: [],
      traits: [trait("GUARDIAN"), trait("MYSTIC")],
      text: text("Battle Mage — Action: Discard 1 card from your hand."),
      abilities: [],
    },
    alterEgo: {
      faceName: "Adam Warlock",
      rec: 3,
      handSize: 6,
      keywords: [],
      traits: [trait("MYSTIC")],
      text: text(
        "Avatar of Life — During deck-building, your deck must include an equal number of cards from all 4 aspects.",
      ),
      abilities: [],
    },
    obligationCardId: cardId("21066"),
    nemesisEncounterSetId: encounterSetId("adam_warlock_nemesis"),
    deckbuilding: { aspectCount: 4, equalCardsPerAspect: true, maxCopiesPerTitle: 1 },
  } satisfies HeroIdentityCard;

  it("four aspects, equal counts and one copy per title validate", () => {
    expect(validateCard(warlock).errors).toEqual([]);
  });

  it("a limit below one is refused", () => {
    const zero = { ...warlock, deckbuilding: { ...warlock.deckbuilding, maxCopiesPerTitle: 0 } };
    expect(validateCard(zero).errors).toContain("deckbuilding maxCopiesPerTitle must be a positive whole number");
  });
});

const towerStage = (stageNumber: number, villainOf: string): MainSchemeStage => ({
  stageNumber,
  startingThreat: flat(1),
  targetThreat: perPlayerOnly(6),
  acceleration: flat(1),
  villainOf,
  icons: [],
  text: text(
    `${villainOf}'s Scheme.\nForced Interrupt: When this stage would be completed, remove all the threat from this stage instead.`,
  ),
  traits: [],
  keywords: [],
  abilities: [],
  aSide: { text: text("When Revealed: Put the Avengers Tower environment into play."), abilities: [] },
});

describe("§1.5 / §1.6 Tower Defense: main schemes that belong to villains, one shared encounter deck", () => {
  const underSiege: MainSchemeCard = {
    id: cardId("21098"),
    type: "main_scheme",
    name: "Under Siege",
    setCode: setCode("mts"),
    cycleId: CYCLE,
    collectorNumber: "98",
    quantityInSet: 1,
    unique: false,
    encounterSetIds: [encounterSetId("tower_defense")],
    stages: [towerStage(1, "Proxima Midnight"), towerStage(2, "Corvus Glaive")],
  };
  const towerDefense: Scenario = {
    id: scenarioId("tower-defense"),
    name: "Tower Defense",
    packCode: setCode("mts"),
    villainCardId: cardId("21092"),
    mainSchemeCardId: cardId("21098"),
    encounterSetIds: [encounterSetId("tower_defense")],
    recommendedModularSetIds: [encounterSetId("armies_of_titan")],
    standardEncounterSetIds: [encounterSetId("standard")],
    expertEncounterSetIds: [encounterSetId("expert")],
    villainStages: { standard: [1, 2], expert: [2, 3] },
    multipleVillains: {
      villains: [
        { villainCardId: cardId("21092"), encounterSetIds: [] },
        { villainCardId: cardId("21095"), encounterSetIds: [] },
      ],
      encounterDecks: "shared",
      activation: "activeVillainOnly",
      winCondition: "allVillainsDefeated",
    },
  };

  it("'Proxima Midnight's Scheme.' is data on the stage", () => {
    expect(validateCard(underSiege).errors).toEqual([]);
    const blank = { ...underSiege, stages: [{ ...towerStage(1, "Proxima Midnight"), villainOf: " " }] } as const;
    expect(validateCard(blank).errors).toContain("main scheme stage 1 villainOf must name a villain when present");
  });

  it("a shared encounter deck needs no per-villain sets; a per-villain one still does", () => {
    expect(validateScenario(towerDefense).errors).toEqual([]);
    const perVillain = {
      ...towerDefense,
      multipleVillains: { ...towerDefense.multipleVillains!, encounterDecks: "perVillain" as const },
    };
    expect(validateScenario(perVillain).errors.some((e) => e.includes("needs the encounter sets"))).toBe(true);
  });
});

describe("§1.7 a card whose other face is its own card", () => {
  const secure = sideScheme({ id: cardId("21180a"), name: "Secure the Landing Pad", otherFaceId: cardId("21180b") });
  const cosmo: AllyCard = {
    id: cardId("21180b"),
    type: "ally",
    name: "Cosmo",
    setCode: setCode("mts"),
    cycleId: CYCLE,
    collectorNumber: "180B",
    quantityInSet: 1,
    unique: true,
    cost: 0,
    resourceIcons: {},
    atk: 2,
    thw: 2,
    hp: 3,
    consequentialDamage: { attack: 1, thwart: 1 },
    aspect: "basic",
    traits: [trait("GUARDIAN")],
    keywords: [],
    deckLimit: 1,
    text: text("The first player gains control of Cosmo."),
    abilities: [],
    specificTo: { kind: "campaign", encounterSetId: encounterSetId("mts_campaign") },
    otherFaceId: cardId("21180a"),
  };

  it("a side scheme and an ally name each other", () => {
    expect(validateCard(secure).errors).toEqual([]);
    expect(validateCard(cosmo).errors).toEqual([]);
  });

  it("a card cannot be its own other face, nor also carry a flipSide", () => {
    expect(validateCard({ ...secure, otherFaceId: secure.id }).errors).toContain(
      "otherFaceId cannot name the card itself",
    );
    const both = upgrade({
      id: cardId("21187a"),
      name: "Norn Stone",
      otherFaceId: cardId("21187b"),
      flipSide: { name: "Norn Stone", traits: [], keywords: [], text: text("Permanent."), abilities: [] },
    });
    expect(validateCard(both).errors).toContain("a card with otherFaceId cannot also have a flipSide");
  });
});

describe("§1.8 'Standard Mode Only' / 'Expert Mode Only' faces", () => {
  const formidableFoe: EnvironmentCard = {
    id: cardId("24049a"),
    type: "environment",
    name: "Formidable Foe",
    setCode: setCode("hood"),
    cycleId: CYCLE,
    collectorNumber: "49A",
    quantityInSet: 1,
    unique: false,
    encounterSetIds: [encounterSetId("standard_ii")],
    boostIcons: 0,
    traits: [],
    keywords: [{ name: "permanent" }, { name: "setup" }],
    text: text("Permanent. Setup.\nThe villain gains steady."),
    abilities: [{ id: "24049a.formidable-foe-constant" as never }],
    modeOnly: "standard",
    flipSide: {
      name: "Formidable Foe",
      traits: [],
      keywords: [{ name: "permanent" }, { name: "setup" }],
      text: text("Permanent. Setup.\nEach enemy gains steady."),
      abilities: [{ id: "24049b.formidable-foe-constant" as never }],
      modeOnly: "expert",
    },
  };

  it("each face names its mode", () => {
    expect(validateCard(formidableFoe).errors).toEqual([]);
  });

  it("two faces of the same mode, or an unknown mode, are refused", () => {
    const same = { ...formidableFoe, flipSide: { ...formidableFoe.flipSide!, modeOnly: "standard" as const } };
    expect(validateCard(same).errors.some((e) => e.includes("modeOnly repeats"))).toBe(true);
    const odd = { ...formidableFoe, modeOnly: "heroic" as never };
    expect(validateCard(odd).errors).toContain("environment modeOnly must be 'standard' or 'expert'");
  });
});

describe("§1.9 / §1.10 encounter sets: classification, a set's own deck, single-villain sets", () => {
  const standardII: EncounterSet = {
    id: encounterSetId("standard_ii"),
    name: "Standard II",
    packCodes: [setCode("hood")],
    classification: "standard",
  };
  const gauntlet: EncounterSet = {
    id: encounterSetId("infinity_gauntlet"),
    name: "Infinity Gauntlet",
    packCodes: [setCode("mts")],
    singleVillainOnly: true,
    separateDecks: [
      {
        name: "Infinity Stone",
        contents: { encounterSetIds: [encounterSetId("infinity_gauntlet")], trait: trait("INFINITY STONE") },
        discardPile: "own",
        whenEmpty: "reshuffleDiscardWithoutPenalty",
      },
    ],
  };
  const hood: Scenario = {
    id: scenarioId("the-hood"),
    name: "The Hood",
    packCode: setCode("hood"),
    villainCardId: cardId("24001"),
    mainSchemeCardId: cardId("24004"),
    encounterSetIds: [encounterSetId("the_hood")],
    recommendedModularSetIds: [],
    standardEncounterSetIds: [encounterSetId("standard")],
    expertEncounterSetIds: [encounterSetId("expert")],
    villainStages: { standard: [1, 2], expert: [2, 3] },
    modularSetCount: 0,
    setAsideModularSetCount: 7,
  };
  const sets: readonly EncounterSet[] = [
    standardII,
    gauntlet,
    { id: encounterSetId("the_hood"), name: "The Hood", packCodes: [setCode("hood")] },
    { id: encounterSetId("standard"), name: "Standard", packCodes: [setCode("core")], classification: "standard" },
    { id: encounterSetId("expert"), name: "Expert", packCodes: [setCode("core")], classification: "expert" },
  ];

  it("each set validates", () => {
    expect(validateEncounterSet(standardII).errors).toEqual([]);
    expect(validateEncounterSet(gauntlet).errors).toEqual([]);
  });

  it("a set's deck needs contents, and an unknown card type is refused", () => {
    const empty = { ...gauntlet, separateDecks: [{ ...gauntlet.separateDecks![0]!, contents: {} }] };
    expect(validateEncounterSet(empty).errors.some((e) => e.includes("contents must name"))).toBe(true);
    const minions = {
      ...gauntlet,
      separateDecks: [{ ...gauntlet.separateDecks![0]!, contents: { cardType: "minion" as never } }],
    };
    expect(validateEncounterSet(minions).errors.some((e) => e.includes("'side_scheme' or 'environment'"))).toBe(true);
  });

  it("§1.12 The Hood sets seven modular sets aside, and a Standard-classification set is never a modular choice", () => {
    expect(validateScenario(hood).errors).toEqual([]);
    expect(validateScenarioEncounterSets(hood, sets).errors).toEqual([]);
    const wrong = { ...hood, recommendedModularSetIds: [encounterSetId("standard_ii")] };
    expect(validateScenarioEncounterSets(wrong, sets).errors).toContain(
      "scenario the-hood recommends standard set standard_ii as a modular set",
    );
    expect(validateScenario({ ...hood, setAsideModularSetCount: 0 }).errors).toContain(
      "scenario setAsideModularSetCount must be a positive whole number",
    );
  });

  it("the Infinity Gauntlet set cannot join a scenario with several villains", () => {
    const twoVillains: Scenario = {
      ...hood,
      encounterSetIds: [encounterSetId("the_hood"), encounterSetId("infinity_gauntlet")],
      multipleVillains: {
        villains: [
          { villainCardId: cardId("24001"), encounterSetIds: [] },
          { villainCardId: cardId("24002"), encounterSetIds: [] },
        ],
        encounterDecks: "shared",
        activation: "activeVillainOnly",
        winCondition: "allVillainsDefeated",
      },
    };
    expect(validateScenarioEncounterSets(twoVillains, sets).errors).toContain(
      "scenario the-hood has several villains, so it cannot use set infinity_gauntlet",
    );
  });
});

describe("§1.11 Loki: a random starting villain and a victory count", () => {
  const loki: Scenario = {
    id: scenarioId("loki"),
    name: "Loki",
    packCode: setCode("mts"),
    villainCardId: cardId("21160"),
    mainSchemeCardId: cardId("21165"),
    encounterSetIds: [encounterSetId("loki"), encounterSetId("infinity_gauntlet")],
    recommendedModularSetIds: [encounterSetId("enchantress"), encounterSetId("frost_giants")],
    standardEncounterSetIds: [encounterSetId("standard")],
    expertEncounterSetIds: [encounterSetId("expert")],
    villainStages: { standard: [1, 1], expert: [1, 1] },
    modularSetCount: 2,
    setAsideVillainCardIds: ["21161", "21162", "21163", "21164"].map(cardId),
    startingVillain: "random",
    victoryCondition: { skirmish: 1, standard: 2, expert: 3, heroic: 4 },
    victory: "cardAbility",
  };

  it("validates", () => {
    expect(validateScenario(loki).errors).toEqual([]);
  });

  it("a random start needs villains to choose among, and every count is a positive whole number", () => {
    expect(validateScenario({ ...loki, setAsideVillainCardIds: [] }).errors).toContain(
      "scenario startingVillain 'random' needs setAsideVillainCardIds to choose among",
    );
    const zero = { ...loki, victoryCondition: { standard: 2, expert: 0 } };
    expect(validateScenario(zero).errors).toContain("scenario victoryCondition.expert must be a positive whole number");
  });
});
