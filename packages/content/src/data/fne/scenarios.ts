// GENERATED FILE — do not edit by hand.
// Source: MarvelCDB public API https://marvelcdb.com/api/public/cards/fne (fetched 2026-09-13; raw cache: packages/content/raw/marvelcdb/fne.json).
// Hand corrections / curated data: packages/content/scripts/marvelcdb/curation/fne.ts
// Regenerate: pnpm --filter @mc/content ingest -- --pack fne [--offline]

import { cardId, encounterSetId, scenarioId, setCode } from "../../schema/index.js";
import type { Scenario } from "../../schema/index.js";

/** art-museum-heist: MC60 p. 17: "Main Scheme Deck: Art Museum Heist. Encounter Deck: Art Museum Heist, Cops, The Owl, Standard, and the chosen villain's encounter sets." Underling villains and their stages: MC60 p. 5; default Hammerhead: p. 8.; the-getaway: MC60 p. 19: "Main Scheme Deck: The Getaway. Encounter Deck: The Getaway, Cops, Drive, Standard, and chosen villain's encounter sets." Underling villains: MC60 p. 5, p. 8.; protection-racket: MC60 p. 13: "Main Scheme Deck: Protection Racket (x5). Encounter Deck: Protection Racket, Disasters, Tracksuit Mafia, Standard, and chosen villain's encounter sets." "Separate Main Schemes": each player has their own main scheme. Stage 1A Setup (60134a): each player chooses one, at random in expert mode. Underling villains: MC60 p. 5, p. 8.; the-raft-breakout: MC60 p. 15: "Main Scheme Deck: The Raft Breakout. Encounter Deck: The Raft Breakout, The Owl, Tombstone, Standard, and chosen villain's encounter sets." Underling villains: MC60 p. 5, p. 8.; stop-the-presses: MC60 p. 21: "Main Scheme Deck: Stop the Presses! Encounter Deck: Stop the Presses!, Tombstone, Tracksuit Mafia, Standard, and chosen villain's encounter sets." Underling villains: MC60 p. 5, p. 8.; kingpin: MC60 p. 23: "Villain Deck: Kingpin (A1). Remove Kingpin (A1) and add Kingpin (B1) for expert mode. Main Scheme Deck: The King's Gambit, Endgame. Encounter Deck: Kingpin, Tombstone, and Tracksuit Mafia encounter sets. (Important: This scenario does not use the Standard encounter set, but still uses the Expert encounter set in Expert Mode.)" "Double-Sided Villain": one card per mode. Kingpin follows the five others (MC60 p. 8, p. 9 step 4). */
export const FNE_SCENARIOS: readonly Scenario[] = [
  {
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
    villainOptions: {
      options: [
        {
          villainSetId: encounterSetId("hammerhead"),
          villainCardId: cardId("60086"),
          villainStages: { standard: [1, 2], expert: [2, 3] },
        },
        {
          villainSetId: encounterSetId("bullseye"),
          villainCardId: cardId("60065"),
          villainStages: { standard: [1, 2], expert: [2, 3] },
        },
        {
          villainSetId: encounterSetId("electro"),
          villainCardId: cardId("60076"),
          villainStages: { standard: [1, 2], expert: [2, 3] },
        },
        {
          villainSetId: encounterSetId("purple_man"),
          villainCardId: cardId("60097"),
          villainStages: { standard: [1, 2], expert: [2, 3] },
        },
        {
          villainSetId: encounterSetId("typhoid_mary"),
          villainCardId: cardId("60110b"),
          villainStages: { standard: [1, 1], expert: [2, 2] },
          victory: "cardAbility",
        },
      ],
      defaultSetId: encounterSetId("hammerhead"),
    },
  },
  {
    id: scenarioId("the-getaway"),
    name: "The Getaway",
    packCode: setCode("fne"),
    villainCardId: cardId("60086"),
    mainSchemeCardId: cardId("60128a"),
    encounterSetIds: [encounterSetId("hammerhead"), encounterSetId("the_getaway")],
    recommendedModularSetIds: [encounterSetId("cops"), encounterSetId("drive")],
    standardEncounterSetIds: [encounterSetId("standard")],
    expertEncounterSetIds: [encounterSetId("expert")],
    villainStages: { standard: [1, 2], expert: [2, 3] },
    modularSetCount: 2,
    villainOptions: {
      options: [
        {
          villainSetId: encounterSetId("hammerhead"),
          villainCardId: cardId("60086"),
          villainStages: { standard: [1, 2], expert: [2, 3] },
        },
        {
          villainSetId: encounterSetId("bullseye"),
          villainCardId: cardId("60065"),
          villainStages: { standard: [1, 2], expert: [2, 3] },
        },
        {
          villainSetId: encounterSetId("electro"),
          villainCardId: cardId("60076"),
          villainStages: { standard: [1, 2], expert: [2, 3] },
        },
        {
          villainSetId: encounterSetId("purple_man"),
          villainCardId: cardId("60097"),
          villainStages: { standard: [1, 2], expert: [2, 3] },
        },
        {
          villainSetId: encounterSetId("typhoid_mary"),
          villainCardId: cardId("60110b"),
          villainStages: { standard: [1, 1], expert: [2, 2] },
          victory: "cardAbility",
        },
      ],
      defaultSetId: encounterSetId("hammerhead"),
    },
  },
  {
    id: scenarioId("protection-racket"),
    name: "Protection Racket",
    packCode: setCode("fne"),
    villainCardId: cardId("60086"),
    mainSchemeCardId: cardId("60134a"),
    encounterSetIds: [encounterSetId("hammerhead"), encounterSetId("protection_racket")],
    recommendedModularSetIds: [encounterSetId("disasters"), encounterSetId("tracksuit_mafia")],
    standardEncounterSetIds: [encounterSetId("standard")],
    expertEncounterSetIds: [encounterSetId("expert")],
    villainStages: { standard: [1, 2], expert: [2, 3] },
    modularSetCount: 2,
    villainOptions: {
      options: [
        {
          villainSetId: encounterSetId("hammerhead"),
          villainCardId: cardId("60086"),
          villainStages: { standard: [1, 2], expert: [2, 3] },
        },
        {
          villainSetId: encounterSetId("bullseye"),
          villainCardId: cardId("60065"),
          villainStages: { standard: [1, 2], expert: [2, 3] },
        },
        {
          villainSetId: encounterSetId("electro"),
          villainCardId: cardId("60076"),
          villainStages: { standard: [1, 2], expert: [2, 3] },
        },
        {
          villainSetId: encounterSetId("purple_man"),
          villainCardId: cardId("60097"),
          villainStages: { standard: [1, 2], expert: [2, 3] },
        },
        {
          villainSetId: encounterSetId("typhoid_mary"),
          villainCardId: cardId("60110b"),
          villainStages: { standard: [1, 1], expert: [2, 2] },
          victory: "cardAbility",
        },
      ],
      defaultSetId: encounterSetId("hammerhead"),
    },
    mainSchemeChoice: {
      kind: "perPlayer",
      cardIds: [cardId("60134a"), cardId("60135a"), cardId("60136a"), cardId("60137a"), cardId("60138a")],
      expert: "random",
    },
  },
  {
    id: scenarioId("the-raft-breakout"),
    name: "The Raft Breakout",
    packCode: setCode("fne"),
    villainCardId: cardId("60086"),
    mainSchemeCardId: cardId("60142a"),
    encounterSetIds: [encounterSetId("hammerhead"), encounterSetId("the_raft_breakout")],
    recommendedModularSetIds: [encounterSetId("the_owl"), encounterSetId("tombstone")],
    standardEncounterSetIds: [encounterSetId("standard")],
    expertEncounterSetIds: [encounterSetId("expert")],
    villainStages: { standard: [1, 2], expert: [2, 3] },
    modularSetCount: 2,
    villainOptions: {
      options: [
        {
          villainSetId: encounterSetId("hammerhead"),
          villainCardId: cardId("60086"),
          villainStages: { standard: [1, 2], expert: [2, 3] },
        },
        {
          villainSetId: encounterSetId("bullseye"),
          villainCardId: cardId("60065"),
          villainStages: { standard: [1, 2], expert: [2, 3] },
        },
        {
          villainSetId: encounterSetId("electro"),
          villainCardId: cardId("60076"),
          villainStages: { standard: [1, 2], expert: [2, 3] },
        },
        {
          villainSetId: encounterSetId("purple_man"),
          villainCardId: cardId("60097"),
          villainStages: { standard: [1, 2], expert: [2, 3] },
        },
        {
          villainSetId: encounterSetId("typhoid_mary"),
          villainCardId: cardId("60110b"),
          villainStages: { standard: [1, 1], expert: [2, 2] },
          victory: "cardAbility",
        },
      ],
      defaultSetId: encounterSetId("hammerhead"),
    },
  },
  {
    id: scenarioId("stop-the-presses"),
    name: "Stop the Presses!",
    packCode: setCode("fne"),
    villainCardId: cardId("60086"),
    mainSchemeCardId: cardId("60151a"),
    encounterSetIds: [encounterSetId("hammerhead"), encounterSetId("stop_the_presses")],
    recommendedModularSetIds: [encounterSetId("tombstone"), encounterSetId("tracksuit_mafia")],
    standardEncounterSetIds: [encounterSetId("standard")],
    expertEncounterSetIds: [encounterSetId("expert")],
    villainStages: { standard: [1, 2], expert: [2, 3] },
    modularSetCount: 2,
    villainOptions: {
      options: [
        {
          villainSetId: encounterSetId("hammerhead"),
          villainCardId: cardId("60086"),
          villainStages: { standard: [1, 2], expert: [2, 3] },
        },
        {
          villainSetId: encounterSetId("bullseye"),
          villainCardId: cardId("60065"),
          villainStages: { standard: [1, 2], expert: [2, 3] },
        },
        {
          villainSetId: encounterSetId("electro"),
          villainCardId: cardId("60076"),
          villainStages: { standard: [1, 2], expert: [2, 3] },
        },
        {
          villainSetId: encounterSetId("purple_man"),
          villainCardId: cardId("60097"),
          villainStages: { standard: [1, 2], expert: [2, 3] },
        },
        {
          villainSetId: encounterSetId("typhoid_mary"),
          villainCardId: cardId("60110b"),
          villainStages: { standard: [1, 1], expert: [2, 2] },
          victory: "cardAbility",
        },
      ],
      defaultSetId: encounterSetId("hammerhead"),
    },
  },
  {
    id: scenarioId("kingpin"),
    name: "Kingpin",
    packCode: setCode("fne"),
    villainCardId: cardId("60159a"),
    mainSchemeCardId: cardId("60161a"),
    encounterSetIds: [encounterSetId("kingpin")],
    recommendedModularSetIds: [encounterSetId("tombstone"), encounterSetId("tracksuit_mafia")],
    standardEncounterSetIds: [],
    expertEncounterSetIds: [encounterSetId("expert")],
    villainStages: { standard: [1, 1], expert: [1, 1] },
    modularSetCount: 2,
    expertVillains: { villainCardId: cardId("60160a"), setAsideVillainCardIds: [] },
  },
];
