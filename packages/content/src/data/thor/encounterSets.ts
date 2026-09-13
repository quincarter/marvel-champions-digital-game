// GENERATED FILE — do not edit by hand.
// Source: MarvelCDB public API https://marvelcdb.com/api/public/cards/thor (fetched 2026-09-13; raw cache: packages/content/raw/marvelcdb/thor.json).
// Hand corrections / curated data: packages/content/scripts/marvelcdb/curation/thor.ts
// Regenerate: pnpm --filter @mc/content ingest -- --pack thor [--offline]

import { cardId, encounterSetId, setCode } from "../../schema/index.js";
import type { EncounterSet } from "../../schema/index.js";

export const THOR_ENCOUNTER_SETS: readonly EncounterSet[] = [
  {
    id: encounterSetId("thor_nemesis"),
    name: "Thor Nemesis",
    packCodes: [setCode("thor")],
    nemesisOfIdentityId: cardId("06001a"),
  },
];
