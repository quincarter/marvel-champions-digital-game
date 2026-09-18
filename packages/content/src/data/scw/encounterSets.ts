// GENERATED FILE — do not edit by hand.
// Source: MarvelCDB public API https://marvelcdb.com/api/public/cards/scw (fetched 2026-09-13; raw cache: packages/content/raw/marvelcdb/scw.json).
// Hand corrections / curated data: packages/content/scripts/marvelcdb/curation/scw.ts
// Regenerate: pnpm --filter @mc/content ingest -- --pack scw [--offline]

import { cardId, encounterSetId, setCode } from "../../schema/index.js";
import type { EncounterSet } from "../../schema/index.js";

export const SCW_ENCOUNTER_SETS: readonly EncounterSet[] = [
  {
    id: encounterSetId("scw_nemesis"),
    name: "Scarlet Witch Nemesis",
    packCodes: [setCode("scw")],
    nemesisOfIdentityId: cardId("15001a"),
  },
];
