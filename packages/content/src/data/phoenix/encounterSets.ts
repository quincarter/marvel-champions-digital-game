// GENERATED FILE — do not edit by hand.
// Source: MarvelCDB public API https://marvelcdb.com/api/public/cards/phoenix (fetched 2026-09-13; raw cache: packages/content/raw/marvelcdb/phoenix.json).
// Hand corrections / curated data: packages/content/scripts/marvelcdb/curation/phoenix.ts
// Regenerate: pnpm --filter @mc/content ingest -- --pack phoenix [--offline]

import { cardId, encounterSetId, setCode } from "../../schema/index.js";
import type { EncounterSet } from "../../schema/index.js";

export const PHOENIX_ENCOUNTER_SETS: readonly EncounterSet[] = [
  {
    id: encounterSetId("phoenix_nemesis"),
    name: "Phoenix Nemesis",
    packCodes: [setCode("phoenix")],
    nemesisOfIdentityId: cardId("34001a"),
  },
];
