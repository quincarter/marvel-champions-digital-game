// GENERATED FILE — do not edit by hand.
// Source: MarvelCDB public API https://marvelcdb.com/api/public/cards/deadpool (fetched 2026-09-13; raw cache: packages/content/raw/marvelcdb/deadpool.json).
// Hand corrections / curated data: packages/content/scripts/marvelcdb/curation/deadpool.ts
// Regenerate: pnpm --filter @mc/content ingest -- --pack deadpool [--offline]

import { cardId, encounterSetId, setCode } from "../../schema/index.js";
import type { EncounterSet } from "../../schema/index.js";

export const DEADPOOL_ENCOUNTER_SETS: readonly EncounterSet[] = [
  {
    id: encounterSetId("deadpool_nemesis"),
    name: "Deadpool Nemesis",
    packCodes: [setCode("deadpool")],
    nemesisOfIdentityId: cardId("44001a"),
  },
  { id: encounterSetId("dreadpool"), name: "Dreadpool", packCodes: [setCode("deadpool")] },
];
