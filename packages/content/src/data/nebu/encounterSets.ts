// GENERATED FILE — do not edit by hand.
// Source: MarvelCDB public API https://marvelcdb.com/api/public/cards/nebu (fetched 2026-09-13; raw cache: packages/content/raw/marvelcdb/nebu.json).
// Hand corrections / curated data: packages/content/scripts/marvelcdb/curation/nebu.ts
// Regenerate: pnpm --filter @mc/content ingest -- --pack nebu [--offline]

import { cardId, encounterSetId, setCode } from "../../schema/index.js";
import type { EncounterSet } from "../../schema/index.js";

export const NEBU_ENCOUNTER_SETS: readonly EncounterSet[] = [
  {
    id: encounterSetId("nebu_nemesis"),
    name: "Nebula Nemesis",
    packCodes: [setCode("nebu")],
    nemesisOfIdentityId: cardId("22001a"),
  },
];
