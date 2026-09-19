// GENERATED FILE — do not edit by hand.
// Source: MarvelCDB public API https://marvelcdb.com/api/public/cards/toafk (fetched 2026-09-13; raw cache: packages/content/raw/marvelcdb/toafk.json).
// Hand corrections / curated data: packages/content/scripts/marvelcdb/curation/toafk.ts
// Regenerate: pnpm --filter @mc/content ingest -- --pack toafk [--offline]

import { cardId, encounterSetId, scenarioId, setCode } from "../../schema/index.js";
import type { Scenario } from "../../schema/index.js";

/** kang: The Once and Future Kang insert, "Setup"/"Adjustable Difficulty"/"Modular Encounter Sets"/"Create Separate Game Areas"/"Playing With Separate Game Areas"/"Rules Clarifications"; RRG 1.8 FAQ "The Once and Future Kang Scenario Pack" (p. 60); docs/phase7-wave2.md §1.8, §2.3 */
export const TOAFK_SCENARIOS: readonly Scenario[] = [
  {
    id: scenarioId("kang"),
    name: "Kang",
    packCode: setCode("toafk"),
    villainCardId: cardId("11001"),
    mainSchemeCardId: cardId("11007a"),
    encounterSetIds: [encounterSetId("kang")],
    recommendedModularSetIds: [encounterSetId("temporal")],
    standardEncounterSetIds: [encounterSetId("standard")],
    expertEncounterSetIds: [encounterSetId("expert")],
    villainStages: { standard: [1, 1], expert: [1, 1] },
    setAsideVillainCardIds: [cardId("11002"), cardId("11003"), cardId("11004"), cardId("11005"), cardId("11006")],
    expertVillains: {
      villainCardId: cardId("11034"),
      setAsideVillainCardIds: [cardId("11035"), cardId("11036"), cardId("11037"), cardId("11038"), cardId("11039")],
    },
    victory: "cardAbility",
    separateGameAreas: {
      isolation: "areasCannotAffectEachOther",
      centralStageNumber: 2,
      encounterDeck: "shared",
      environments: "inEveryArea",
      eachPlayer: "sameArea",
      uniqueness: "perArea",
      joining: "sideSchemesAndEngagedMinionsMove",
    },
  },
];
