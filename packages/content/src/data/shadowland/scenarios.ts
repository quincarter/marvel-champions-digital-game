// GENERATED FILE — do not edit by hand.
// Source: Hall of Heroes preview scans, hand-transcribed as addedRecords (no MarvelCDB pack "shadowland": every record is an addedRecord transcribed from scans (curation/shadowland.ts); export: packages/content/raw/hallofheroes/shadowland.json).
// Hand corrections / curated data: packages/content/scripts/marvelcdb/curation/shadowland.ts
// Regenerate: pnpm --filter @mc/content ingest -- --pack shadowland [--offline]

import { cardId, encounterSetId, scenarioId, setCode } from "../../schema/index.js";
import type { Scenario } from "../../schema/index.js";

/** shadows-in-the-night: Main scheme 65001 1A Contents: "Shadows in the Night, Dark Protégé, and Standard encounter sets. One modular encounter set (Ninja Swarm)." Setup: "Set the Dark Protégé encounter set aside. Choose 1 random villain from that set and reveal its side A, then shuffle each card linked to that villain into the encounter deck." 65001B/65002B: the villain flips A to B (HP reset) instead of being defeated on side A; defeated on side B wins. Insert pp. 4, 7 to 10; campaign instructions (p. 9): +1 [per_hero] threat on the main scheme, Creeping Corruption from Black Flower. RRG "Linked" (p. 27): linked cards are never in a deck and are set aside at setup; the 1A Setup above shuffles the 5 cards linked to the chosen villain in, so the other 5 stay set aside.; shadow-labyrinth: Main scheme 65038 1A Contents: "Shifting Corridors (A). Shadow Labyrinth, Dark Protégé, Deadly Contraptions, and Standard encounter sets. One modular encounter set (Ninja Swarm)." Setup: "Create the trap deck. Set the Dark Protégé encounter set aside. Choose 1 random villain from that set, then shuffle each card linked to that villain into the encounter deck (keep the chosen villain set aside)." Insert pp. 11 to 15 (trap deck p. 12, infinite hit points and passage counters p. 13); campaign instructions (p. 14): +3 [per_hero] threat on the main scheme. 1B places 10 [per_hero] passage counters (7 in expert mode). RRG "Linked" (p. 27) sets linked cards aside; the 1A Setup above shuffles the cards linked to the chosen villain in.; heart-of-shadow: Main scheme 65060 1A Contents: "Krahllak (I) and Krahllak (II). (Krahllak (II) and Krahllak (III) instead for expert mode.) Heart of Shadow, Black Flower, and Standard encounter sets. One modular encounter set (Ninja Swarm)." Krahllak is 65057 (I, HP 18), 65058 (II, HP 21), 65059 (III, HP 25), each one-sided. Insert pp. 16 to 17; campaign instructions (p. 17): no extra main scheme threat is printed, the four minions of the Dark Protégé set (Archpriestess, Gorgon, Lady Bullseye, White Tiger) are dealt facedown at random, one per player. */
export const SHADOWLAND_SCENARIOS: readonly Scenario[] = [
  {
    id: scenarioId("shadows-in-the-night"),
    name: "Shadows in the Night",
    packCode: setCode("shadowland"),
    villainCardId: cardId("65012a"),
    mainSchemeCardId: cardId("65001a"),
    encounterSetIds: [encounterSetId("shadows_in_the_night")],
    recommendedModularSetIds: [encounterSetId("ninja_swarm")],
    standardEncounterSetIds: [encounterSetId("standard")],
    expertEncounterSetIds: [encounterSetId("expert")],
    villainStages: { standard: [1, 1], expert: [1, 1] },
    modularSetCount: 1,
    villainOptions: {
      options: [
        {
          villainSetId: encounterSetId("dark_protege"),
          villainCardId: cardId("65012a"),
          villainStages: { standard: [1, 1], expert: [1, 1] },
          linkedCardIds: [cardId("65019"), cardId("65022"), cardId("65023"), cardId("65024"), cardId("65026")],
        },
        {
          villainSetId: encounterSetId("dark_protege"),
          villainCardId: cardId("65013a"),
          villainStages: { standard: [1, 1], expert: [1, 1] },
          linkedCardIds: [cardId("65019"), cardId("65021"), cardId("65023"), cardId("65025"), cardId("65027")],
        },
        {
          villainSetId: encounterSetId("dark_protege"),
          villainCardId: cardId("65014a"),
          villainStages: { standard: [1, 1], expert: [1, 1] },
          linkedCardIds: [cardId("65018"), cardId("65021"), cardId("65023"), cardId("65024"), cardId("65027")],
        },
        {
          villainSetId: encounterSetId("dark_protege"),
          villainCardId: cardId("65015a"),
          villainStages: { standard: [1, 1], expert: [1, 1] },
          linkedCardIds: [cardId("65019"), cardId("65020"), cardId("65022"), cardId("65025"), cardId("65026")],
        },
        {
          villainSetId: encounterSetId("dark_protege"),
          villainCardId: cardId("65016a"),
          villainStages: { standard: [1, 1], expert: [1, 1] },
          linkedCardIds: [cardId("65018"), cardId("65020"), cardId("65021"), cardId("65025"), cardId("65026")],
        },
        {
          villainSetId: encounterSetId("dark_protege"),
          villainCardId: cardId("65017a"),
          villainStages: { standard: [1, 1], expert: [1, 1] },
          linkedCardIds: [cardId("65018"), cardId("65020"), cardId("65022"), cardId("65024"), cardId("65027")],
        },
      ],
      defaultSetId: encounterSetId("dark_protege"),
      keyedBy: "card",
      defaultCardId: cardId("65012a"),
      selection: "random",
      chosenVillain: "inPlay",
    },
  },
  {
    id: scenarioId("shadow-labyrinth"),
    name: "Shadow Labyrinth",
    packCode: setCode("shadowland"),
    villainCardId: cardId("65037"),
    mainSchemeCardId: cardId("65038a"),
    encounterSetIds: [encounterSetId("shadow_labyrinth"), encounterSetId("deadly_contraptions")],
    recommendedModularSetIds: [encounterSetId("ninja_swarm")],
    standardEncounterSetIds: [encounterSetId("standard")],
    expertEncounterSetIds: [encounterSetId("expert")],
    villainStages: { standard: [1, 1], expert: [1, 1] },
    modularSetCount: 1,
    villainOptions: {
      options: [
        {
          villainSetId: encounterSetId("dark_protege"),
          villainCardId: cardId("65012a"),
          villainStages: { standard: [1, 1], expert: [1, 1] },
          linkedCardIds: [cardId("65019"), cardId("65022"), cardId("65023"), cardId("65024"), cardId("65026")],
        },
        {
          villainSetId: encounterSetId("dark_protege"),
          villainCardId: cardId("65013a"),
          villainStages: { standard: [1, 1], expert: [1, 1] },
          linkedCardIds: [cardId("65019"), cardId("65021"), cardId("65023"), cardId("65025"), cardId("65027")],
        },
        {
          villainSetId: encounterSetId("dark_protege"),
          villainCardId: cardId("65014a"),
          villainStages: { standard: [1, 1], expert: [1, 1] },
          linkedCardIds: [cardId("65018"), cardId("65021"), cardId("65023"), cardId("65024"), cardId("65027")],
        },
        {
          villainSetId: encounterSetId("dark_protege"),
          villainCardId: cardId("65015a"),
          villainStages: { standard: [1, 1], expert: [1, 1] },
          linkedCardIds: [cardId("65019"), cardId("65020"), cardId("65022"), cardId("65025"), cardId("65026")],
        },
        {
          villainSetId: encounterSetId("dark_protege"),
          villainCardId: cardId("65016a"),
          villainStages: { standard: [1, 1], expert: [1, 1] },
          linkedCardIds: [cardId("65018"), cardId("65020"), cardId("65021"), cardId("65025"), cardId("65026")],
        },
        {
          villainSetId: encounterSetId("dark_protege"),
          villainCardId: cardId("65017a"),
          villainStages: { standard: [1, 1], expert: [1, 1] },
          linkedCardIds: [cardId("65018"), cardId("65020"), cardId("65022"), cardId("65024"), cardId("65027")],
        },
      ],
      defaultSetId: encounterSetId("dark_protege"),
      keyedBy: "card",
      defaultCardId: cardId("65012a"),
      selection: "random",
      chosenVillain: "setAside",
    },
  },
  {
    id: scenarioId("heart-of-shadow"),
    name: "Heart of Shadow",
    packCode: setCode("shadowland"),
    villainCardId: cardId("65057"),
    mainSchemeCardId: cardId("65060a"),
    encounterSetIds: [encounterSetId("heart_of_shadow"), encounterSetId("black_flower")],
    recommendedModularSetIds: [encounterSetId("ninja_swarm")],
    standardEncounterSetIds: [encounterSetId("standard")],
    expertEncounterSetIds: [encounterSetId("expert")],
    villainStages: { standard: [1, 2], expert: [2, 3] },
    modularSetCount: 1,
  },
];
