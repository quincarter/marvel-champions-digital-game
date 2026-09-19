// GENERATED FILE — do not edit by hand.
// Source: MarvelCDB public API https://marvelcdb.com/api/public/cards/iceman (fetched 2026-09-13; raw cache: packages/content/raw/marvelcdb/iceman.json).
// Hand corrections / curated data: packages/content/scripts/marvelcdb/curation/iceman.ts
// Regenerate: pnpm --filter @mc/content ingest -- --pack iceman [--offline]

import { cardId, encounterSetId, setCode } from "../../schema/index.js";
import type { EncounterSet } from "../../schema/index.js";

export const ICEMAN_ENCOUNTER_SETS: readonly EncounterSet[] = [
  {
    id: encounterSetId("iceman_nemesis"),
    name: "Iceman Nemesis",
    packCodes: [setCode("iceman")],
    nemesisOfIdentityId: cardId("46001a"),
  },
  { id: encounterSetId("sauron"), name: "Sauron", packCodes: [setCode("iceman")] },
];
