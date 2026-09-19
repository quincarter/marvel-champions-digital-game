// GENERATED FILE — do not edit by hand.
// Source: MarvelCDB public API https://marvelcdb.com/api/public/cards/falcon (fetched 2026-09-13; raw cache: packages/content/raw/marvelcdb/falcon.json).
// Hand corrections / curated data: packages/content/scripts/marvelcdb/curation/falcon.ts
// Regenerate: pnpm --filter @mc/content ingest -- --pack falcon [--offline]

import { cardId, encounterSetId, setCode } from "../../schema/index.js";
import type { EncounterSet } from "../../schema/index.js";

export const FALCON_ENCOUNTER_SETS: readonly EncounterSet[] = [
  {
    id: encounterSetId("falcon_nemesis"),
    name: "Falcon Nemesis",
    packCodes: [setCode("falcon")],
    nemesisOfIdentityId: cardId("53001a"),
  },
  { id: encounterSetId("techno"), name: "Techno", packCodes: [setCode("falcon")] },
];
