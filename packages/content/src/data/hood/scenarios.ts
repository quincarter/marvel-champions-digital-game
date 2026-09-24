// GENERATED FILE — do not edit by hand.
// Source: MarvelCDB public API https://marvelcdb.com/api/public/cards/hood (fetched 2026-09-13; raw cache: packages/content/raw/marvelcdb/hood.json).
// Hand corrections / curated data: packages/content/scripts/marvelcdb/curation/hood.ts
// Regenerate: pnpm --filter @mc/content ingest -- --pack hood [--offline]

import { cardId, encounterSetId, scenarioId, setCode } from "../../schema/index.js";
import type { Scenario } from "../../schema/index.js";

/** the-hood: MC21 has no rulebook for The Hood in the repo; villain/main-scheme stage numbers and the seven-set-aside/one-shuffled-in setup are the raw MarvelCDB records (24001-24006, standard I-II / expert II-III, the pack's own villain/main_scheme stage labels) plus Making Connections 1A's own printed text (docs/phase7-wave4.md §1.12, §2.3, §3.18). */
export const HOOD_SCENARIOS: readonly Scenario[] = [
  {
    id: scenarioId("the-hood"),
    name: "The Hood",
    packCode: setCode("hood"),
    villainCardId: cardId("24001"),
    mainSchemeCardId: cardId("24004a"),
    encounterSetIds: [encounterSetId("the_hood")],
    recommendedModularSetIds: [],
    standardEncounterSetIds: [encounterSetId("standard")],
    expertEncounterSetIds: [encounterSetId("expert")],
    villainStages: { standard: [1, 2], expert: [2, 3] },
    modularSetCount: 0,
    setAsideModularSetCount: 7,
  },
];
