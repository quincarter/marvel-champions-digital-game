import { describe, expect, it } from "vitest";
import {
  cardId,
  encounterSetId,
  scenarioId,
  setCode,
  validateScenario,
  validateScenarioEncounterSets,
  validateScenarioVillainOptions,
} from "./index.js";
import type { EncounterSet, Scenario, VillainOption } from "./index.js";
import { CORE_CARDS } from "../data/core/cards.js";
import { CORE_ENCOUNTER_SETS } from "../data/core/encounterSets.js";
import { FNE_CARDS } from "../data/fne/cards.js";
import { FNE_ENCOUNTER_SETS } from "../data/fne/encounterSets.js";

/**
 * `Scenario.villainOptions` (docs/phase7-wave11-scenarios.md §S1.2): MC60 p. 5, "five of this expansion's scenarios
 * combine one of five interchangeable main schemes with one of the five interchangeable villains". A fixture Art
 * Museum Heist record against the real `fne` villain cards; the box's own records are a later data task.
 */

const CARDS = [...CORE_CARDS, ...FNE_CARDS];
const SETS: readonly EncounterSet[] = [...CORE_ENCOUNTER_SETS, ...FNE_ENCOUNTER_SETS];

const option = (set: string, card: string, extra: Partial<VillainOption> = {}): VillainOption => ({
  villainSetId: encounterSetId(set),
  villainCardId: cardId(card),
  villainStages: { standard: [1, 2], expert: [2, 3] },
  ...extra,
});

const OPTIONS: readonly VillainOption[] = [
  option("hammerhead", "60086"),
  option("bullseye", "60065"),
  option("electro", "60076"),
  option("purple_man", "60097"),
  option("typhoid_mary", "60110b", { villainStages: { standard: [1, 1], expert: [2, 2] }, victory: "cardAbility" }),
];

const HEIST: Scenario = {
  id: scenarioId("art-museum-heist"),
  name: "Art Museum Heist",
  packCode: setCode("fne"),
  villainCardId: cardId("60086"),
  mainSchemeCardId: cardId("60121a"),
  encounterSetIds: [encounterSetId("hammerhead"), encounterSetId("art_museum_heist")],
  recommendedModularSetIds: [encounterSetId("cops"), encounterSetId("the_owl")],
  standardEncounterSetIds: [encounterSetId("standard")],
  expertEncounterSetIds: [encounterSetId("expert")],
  villainStages: { standard: [1, 2], expert: [2, 3] },
  modularSetCount: 2,
  villainOptions: { options: OPTIONS, defaultSetId: encounterSetId("hammerhead") },
};

const errorsOf = (s: Scenario): readonly string[] => validateScenario(s).errors;

describe("validateScenario: villainOptions on its own", () => {
  it("accepts the five Fear No Evil villains with Hammerhead the default", () => {
    expect(errorsOf(HEIST)).toEqual([]);
  });

  it("refuses a default that is not an option, or that the record's own villain fields do not describe", () => {
    const missing = { ...HEIST, villainOptions: { options: OPTIONS, defaultSetId: encounterSetId("kingpin") } };
    expect(errorsOf(missing)).toEqual([
      "scenario villainOptions option hammerhead is not the default, so encounterSetIds must not name its set",
      "scenario villainOptions.defaultSetId must be one of the options' villainSetId",
    ]);
    expect(errorsOf({ ...HEIST, villainCardId: cardId("60065") })).toEqual([
      "scenario villainOptions: villainCardId must be the default option's (60086)",
    ]);
    expect(errorsOf({ ...HEIST, villainStages: { standard: [1, 1], expert: [2, 2] } })).toEqual([
      "scenario villainOptions: villainStages must be the default option's",
    ]);
    expect(errorsOf({ ...HEIST, victory: "cardAbility" })).toEqual([
      "scenario villainOptions: victory must be the default option's",
    ]);
    expect(errorsOf({ ...HEIST, encounterSetIds: [encounterSetId("art_museum_heist")] })).toEqual([
      "scenario villainOptions: encounterSetIds must name the default villain's set hammerhead",
    ]);
  });

  it("refuses another option's set among the record's own sets, a set twice, and fewer than two options", () => {
    const both = { ...HEIST, encounterSetIds: [...HEIST.encounterSetIds, encounterSetId("bullseye")] };
    expect(errorsOf(both)).toEqual([
      "scenario villainOptions option bullseye is not the default, so encounterSetIds must not name its set",
    ]);
    const twice = { ...HEIST, villainOptions: { ...HEIST.villainOptions!, options: [...OPTIONS, OPTIONS[1]!] } };
    expect(errorsOf(twice)).toEqual(["scenario villainOptions lists set bullseye twice"]);
    const one = { ...HEIST, villainOptions: { ...HEIST.villainOptions!, options: [OPTIONS[0]!] } };
    expect(errorsOf(one)).toEqual(["scenario villainOptions must list at least two villains"]);
  });

  it("refuses a malformed option and the villain fields it cannot be combined with", () => {
    const bad = { ...OPTIONS[1]!, villainStages: { standard: [0, 1], expert: [2, 3] }, victory: "never" } as never;
    expect(errorsOf({ ...HEIST, villainOptions: { ...HEIST.villainOptions!, options: [OPTIONS[0]!, bad] } })).toEqual([
      "scenario villainOptions option bullseye villainStages.standard/expert must be [first, last] stage numerals",
      "scenario villainOptions option bullseye victory must be 'finalVillainStage' or 'cardAbility' when present",
    ]);
    expect(errorsOf({ ...HEIST, startingVillain: "bySetup" })).toEqual([
      "scenario villainOptions cannot be combined with startingVillain",
    ]);
  });

  it("a record without the field is unaffected", () => {
    const { villainOptions: _options, ...plain } = HEIST;
    expect(errorsOf(plain)).toEqual([]);
    expect(validateScenarioVillainOptions(plain, CARDS, SETS).errors).toEqual([]);
  });
});

describe("validateScenarioVillainOptions: the options against the cards", () => {
  it("passes the five real villain cards, each in its own set with the stages its option names", () => {
    expect(validateScenarioVillainOptions(HEIST, CARDS, SETS).errors).toEqual([]);
  });

  it("refuses a card of another set, a card that is not a villain, a stage the card lacks and an unknown set", () => {
    const options = [
      OPTIONS[0]!,
      option("bullseye", "60076"),
      option("electro", "60079"),
      option("typhoid_mary", "60110b"),
      option("nobody", "60086"),
    ];
    const s = { ...HEIST, villainOptions: { ...HEIST.villainOptions!, options } };
    expect(validateScenarioVillainOptions(s, CARDS, SETS).errors).toEqual([
      "scenario art-museum-heist villain option bullseye: villain 60076 is not in set bullseye",
      "scenario art-museum-heist villain option electro: 60079 is not a villain card",
      // Typhoid Mary's one card holds two stages, A and B (MC60 p. 5): there is no stage 3.
      "scenario art-museum-heist villain option typhoid_mary: villain 60110b has no stage 3",
      "scenario art-museum-heist villain option nobody: set is not registered",
      "scenario art-museum-heist villain option nobody: villain 60086 is not in set nobody",
    ]);
  });

  it("refuses a record whose set aside cards, modular sets or separate decks carry a villain option's set", () => {
    const s = {
      ...HEIST,
      setAsideCardIds: [cardId("60068a"), cardId("60121a")],
      recommendedModularSetIds: [encounterSetId("cops"), encounterSetId("electro")],
      standardEncounterSetIds: [encounterSetId("standard"), encounterSetId("purple_man")],
      separateDecks: [
        {
          name: "Showcase",
          contents: { encounterSetIds: [encounterSetId("bullseye")], cardIds: [cardId("60079")] },
          discardPile: "own" as const,
          whenEmpty: "reshuffleDiscard" as const,
        },
      ],
    } as unknown as Scenario;
    expect(validateScenarioVillainOptions(s, CARDS, SETS).errors).toEqual([
      "scenario art-museum-heist recommendedModularSetIds names villain option set electro, which the chosen villain decides",
      "scenario art-museum-heist standardEncounterSetIds names villain option set purple_man, which the chosen villain decides",
      "scenario art-museum-heist setAsideCardIds names 60068a, a card of villain option set bullseye",
      "scenario art-museum-heist separateDecks Showcase encounterSetIds names villain option set bullseye, which the chosen villain decides",
      "scenario art-museum-heist separateDecks Showcase cardIds names 60079, a card of villain option set electro",
    ]);
  });

  it("validateScenarioEncounterSets reads every option's set, not only the default's", () => {
    expect(validateScenarioEncounterSets(HEIST, SETS).errors).toEqual([]);
    const campaignSet = option("fne_campaign", "60086");
    const s = { ...HEIST, villainOptions: { ...HEIST.villainOptions!, options: [...OPTIONS, campaignSet] } };
    expect(validateScenarioEncounterSets(s, SETS).errors).toEqual([
      "scenario art-museum-heist names campaign-specific set fne_campaign; a campaign-specific set can only be used during a campaign from the same product",
    ]);
  });
});
