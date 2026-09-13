// GENERATED FILE — do not edit by hand.
// Source: MarvelCDB public API https://marvelcdb.com/api/public/cards/twc (fetched 2026-09-13; raw cache: packages/content/raw/marvelcdb/twc.json).
// Hand corrections / curated data: packages/content/scripts/marvelcdb/curation/twc.ts
// Regenerate: pnpm --filter @mc/content ingest -- --pack twc [--offline]

import { cardId, encounterSetId, scenarioId, setCode } from "../../schema/index.js";
import type { Scenario } from "../../schema/index.js";

/** breakout: Wrecking Crew insert "New Rules" ("The Active Villain", "Prepare Encounter Decks", "Signature Side Schemes", "Adjustable Difficulty" — quoted docs/phase7-wave1.md §1.1, §2.3); Breakout 1A Contents/Setup text (raw 07001a); HoH Wrecking Crew page ("Wrecking Crew - Standard (Side A), Expert (Side B), Extreme Challenge...") */
export const TWC_SCENARIOS: readonly Scenario[] = [
  {
    id: scenarioId("breakout"),
    name: "Breakout",
    packCode: setCode("twc"),
    villainCardId: cardId("07002"),
    mainSchemeCardId: cardId("07001a"),
    encounterSetIds: [],
    recommendedModularSetIds: [],
    standardEncounterSetIds: [],
    expertEncounterSetIds: [],
    villainStages: { standard: [1, 1], expert: [2, 2] },
    multipleVillains: {
      villains: [
        {
          villainCardId: cardId("07002"),
          encounterSetIds: [encounterSetId("wrecker")],
          signatureSideSchemeCardId: cardId("07004"),
        },
        {
          villainCardId: cardId("07017"),
          encounterSetIds: [encounterSetId("thunderball")],
          signatureSideSchemeCardId: cardId("07019"),
        },
        {
          villainCardId: cardId("07032"),
          encounterSetIds: [encounterSetId("piledriver")],
          signatureSideSchemeCardId: cardId("07034"),
        },
        {
          villainCardId: cardId("07046"),
          encounterSetIds: [encounterSetId("bulldozer")],
          signatureSideSchemeCardId: cardId("07048"),
        },
      ],
      encounterDecks: "perVillain",
      activation: "activeVillainOnly",
      winCondition: "allVillainsDefeated",
    },
    usesIdentityEncounterSets: false,
    modularSetCount: 0,
  },
];
