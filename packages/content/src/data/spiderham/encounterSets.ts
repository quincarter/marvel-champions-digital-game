// GENERATED FILE — do not edit by hand.
// Source: MarvelCDB public API https://marvelcdb.com/api/public/cards/spiderham (fetched 2026-09-13; raw cache: packages/content/raw/marvelcdb/spiderham.json).
// Hand corrections / curated data: packages/content/scripts/marvelcdb/curation/spiderham.ts
// Regenerate: pnpm --filter @mc/content ingest -- --pack spiderham [--offline]

import { cardId, encounterSetId, setCode } from "../../schema/index.js";
import type { EncounterSet } from "../../schema/index.js";

export const SPIDERHAM_ENCOUNTER_SETS: readonly EncounterSet[] = [
  { id: encounterSetId("inheritors"), name: "The Inheritors", packCodes: [setCode("spiderham")] },
  {
    id: encounterSetId("spiderham_nemesis"),
    name: "Spider-Ham Nemesis",
    packCodes: [setCode("spiderham")],
    nemesisOfIdentityId: cardId("30001a"),
  },
];
