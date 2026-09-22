// GENERATED FILE — do not edit by hand.
// Source: MarvelCDB public API https://marvelcdb.com/api/public/cards/gmw (fetched 2026-09-13; raw cache: packages/content/raw/marvelcdb/gmw.json).
// Hand corrections / curated data: packages/content/scripts/marvelcdb/curation/gmw.ts
// Regenerate: pnpm --filter @mc/content ingest -- --pack gmw [--offline]

import { cardId, encounterSetId, scenarioId, setCode } from "../../schema/index.js";
import type { Scenario } from "../../schema/index.js";

/** brotherhood-of-badoon: MC16 p. 8, "Scenario 1 - Brotherhood of Badoon"; 1A Contents text (raw 16061a); wave3 §2.2; infiltrate-the-museum: MC16 p. 10, "Scenario 2 - Infiltrate the Museum"; 1A Contents text (raw 16073a); wave3 §2.2; escape-the-museum: MC16 p. 12, "Scenario 3 - Escape the Museum"; 1A Contents/Setup text (raw 16082a); wave3 §1.1, §2.2; nebula: MC16 p. 14, "Scenario 4 - Nebula"; 1A Contents text (raw 16091a); wave3 §2.2; ronan-the-accuser: MC16 p. 18, "Scenario 5 - Ronan the Accuser"; 1A Contents text (raw 16106a); wave3 §2.2 */
export const GMW_SCENARIOS: readonly Scenario[] = [
  {
    id: scenarioId("brotherhood-of-badoon"),
    name: "Brotherhood of Badoon",
    packCode: setCode("gmw"),
    villainCardId: cardId("16058"),
    mainSchemeCardId: cardId("16061a"),
    encounterSetIds: [encounterSetId("brotherhood_of_badoon"), encounterSetId("ship_command")],
    recommendedModularSetIds: [encounterSetId("band_of_badoon")],
    standardEncounterSetIds: [encounterSetId("standard")],
    expertEncounterSetIds: [encounterSetId("expert")],
    villainStages: { standard: [1, 2], expert: [2, 3] },
  },
  {
    id: scenarioId("infiltrate-the-museum"),
    name: "Infiltrate the Museum",
    packCode: setCode("gmw"),
    villainCardId: cardId("16070"),
    mainSchemeCardId: cardId("16073a"),
    encounterSetIds: [encounterSetId("infiltrate_the_museum"), encounterSetId("galactic_artifacts")],
    recommendedModularSetIds: [encounterSetId("menagerie_medley")],
    standardEncounterSetIds: [encounterSetId("standard")],
    expertEncounterSetIds: [encounterSetId("expert")],
    villainStages: { standard: [1, 2], expert: [2, 3] },
  },
  {
    id: scenarioId("escape-the-museum"),
    name: "Escape the Museum",
    packCode: setCode("gmw"),
    villainCardId: cardId("16080a"),
    mainSchemeCardId: cardId("16082a"),
    encounterSetIds: [
      encounterSetId("escape_the_museum"),
      encounterSetId("galactic_artifacts"),
      encounterSetId("ship_command"),
    ],
    recommendedModularSetIds: [encounterSetId("menagerie_medley")],
    standardEncounterSetIds: [encounterSetId("standard")],
    expertEncounterSetIds: [encounterSetId("expert")],
    villainStages: { standard: [1, 1], expert: [1, 1] },
    expertVillains: { villainCardId: cardId("16081a"), setAsideVillainCardIds: [] },
    victory: "cardAbility",
  },
  {
    id: scenarioId("nebula"),
    name: "Nebula",
    packCode: setCode("gmw"),
    villainCardId: cardId("16088"),
    mainSchemeCardId: cardId("16091a"),
    encounterSetIds: [encounterSetId("nebula"), encounterSetId("power_stone"), encounterSetId("ship_command")],
    recommendedModularSetIds: [encounterSetId("space_pirates")],
    standardEncounterSetIds: [encounterSetId("standard")],
    expertEncounterSetIds: [encounterSetId("expert")],
    villainStages: { standard: [1, 2], expert: [2, 3] },
  },
  {
    id: scenarioId("ronan-the-accuser"),
    name: "Ronan the Accuser",
    packCode: setCode("gmw"),
    villainCardId: cardId("16103"),
    mainSchemeCardId: cardId("16106a"),
    encounterSetIds: [encounterSetId("ronan"), encounterSetId("power_stone"), encounterSetId("ship_command")],
    recommendedModularSetIds: [encounterSetId("kree_militant")],
    standardEncounterSetIds: [encounterSetId("standard")],
    expertEncounterSetIds: [encounterSetId("expert")],
    villainStages: { standard: [1, 2], expert: [2, 3] },
  },
];
