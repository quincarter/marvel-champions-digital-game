// GENERATED FILE — do not edit by hand.
// Source: MarvelCDB public API https://marvelcdb.com/api/public/cards/gob (fetched 2026-09-13; raw cache: packages/content/raw/marvelcdb/gob.json).
// Hand corrections / curated data: packages/content/scripts/marvelcdb/curation/gob.ts
// Regenerate: pnpm --filter @mc/content ingest -- --pack gob [--offline]

import { cardId, encounterSetId, scenarioId, setCode } from "../../schema/index.js";
import type { Scenario } from "../../schema/index.js";

/** risky-business: Green Goblin insert "How to Use This Pack"/"Adjustable Difficulty" (quoted docs/phase7-wave1.md §1.3, §2.2); Hostile Takeover 1A Contents text (raw 02004a); HoH Green Goblin page ("Risky Business (Scenario 1 - Suggested Pairing: Power Drain)"); mutagen-formula: Green Goblin insert "Adjustable Difficulty"; Unleashing the Mutagen 1A Contents text (raw 02017a); HoH Green Goblin page ("Mutagen Formula (Scenario 2 - Suggested Pairing: Goblin Gimmicks)") */
export const GOB_SCENARIOS: readonly Scenario[] = [
  {
    id: scenarioId("risky-business"),
    name: "Risky Business",
    packCode: setCode("gob"),
    villainCardId: cardId("02001a"),
    mainSchemeCardId: cardId("02004a"),
    encounterSetIds: [encounterSetId("risky_business")],
    recommendedModularSetIds: [encounterSetId("power_drain")],
    standardEncounterSetIds: [encounterSetId("standard")],
    expertEncounterSetIds: [encounterSetId("expert")],
    villainStages: { standard: [1, 2], expert: [2, 3] },
  },
  {
    id: scenarioId("mutagen-formula"),
    name: "Mutagen Formula",
    packCode: setCode("gob"),
    villainCardId: cardId("02014"),
    mainSchemeCardId: cardId("02017a"),
    encounterSetIds: [encounterSetId("mutagen_formula")],
    recommendedModularSetIds: [encounterSetId("goblin_gimmicks")],
    standardEncounterSetIds: [encounterSetId("standard")],
    expertEncounterSetIds: [encounterSetId("expert")],
    villainStages: { standard: [1, 2], expert: [2, 3] },
  },
];
