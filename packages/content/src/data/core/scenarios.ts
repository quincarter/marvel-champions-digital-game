// GENERATED FILE — do not edit by hand.
// Source: MarvelCDB public API https://marvelcdb.com/api/public/cards/core (fetched 2026-09-11; raw cache: packages/content/raw/marvelcdb/core.json).
// Hand corrections / curated data: packages/content/scripts/marvelcdb/curation/core.ts
// Regenerate: pnpm --filter @mc/content ingest -- --pack core [--offline]

import { cardId, encounterSetId, scenarioId, setCode } from "../../schema/index.js";
import type { Scenario } from "../../schema/index.js";

/** rhino: Core Set Learn to Play (https://hallofheroeslcg.com/wp-content/uploads/2019/12/l2p.pdf) p.23 "Core Scenarios"; The Break-In! 1A Contents text; klaw: Core Set Learn to Play (https://hallofheroeslcg.com/wp-content/uploads/2019/12/l2p.pdf) p.23 "Core Scenarios"; Underground Distribution 1A Contents text; ultron: Core Set Learn to Play (https://hallofheroeslcg.com/wp-content/uploads/2019/12/l2p.pdf) p.23 "Core Scenarios"; The Crimson Cowl 1A Contents text */
export const CORE_SCENARIOS: readonly Scenario[] = [
  {
    id: scenarioId("rhino"),
    name: "Rhino",
    packCode: setCode("core"),
    villainCardId: cardId("01094"),
    mainSchemeCardId: cardId("01097a"),
    encounterSetIds: [encounterSetId("rhino")],
    recommendedModularSetIds: [encounterSetId("bomb_scare")],
    standardEncounterSetIds: [encounterSetId("standard")],
    expertEncounterSetIds: [encounterSetId("expert")],
    villainStages: { standard: [1, 2], expert: [2, 3] },
  },
  {
    id: scenarioId("klaw"),
    name: "Klaw",
    packCode: setCode("core"),
    villainCardId: cardId("01113"),
    mainSchemeCardId: cardId("01116a"),
    encounterSetIds: [encounterSetId("klaw")],
    recommendedModularSetIds: [encounterSetId("masters_of_evil")],
    standardEncounterSetIds: [encounterSetId("standard")],
    expertEncounterSetIds: [encounterSetId("expert")],
    villainStages: { standard: [1, 2], expert: [2, 3] },
  },
  {
    id: scenarioId("ultron"),
    name: "Ultron",
    packCode: setCode("core"),
    villainCardId: cardId("01134"),
    mainSchemeCardId: cardId("01137a"),
    encounterSetIds: [encounterSetId("ultron")],
    recommendedModularSetIds: [encounterSetId("under_attack")],
    standardEncounterSetIds: [encounterSetId("standard")],
    expertEncounterSetIds: [encounterSetId("expert")],
    villainStages: { standard: [1, 2], expert: [2, 3] },
  },
];
