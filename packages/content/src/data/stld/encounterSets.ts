// GENERATED FILE — do not edit by hand.
// Source: MarvelCDB public API https://marvelcdb.com/api/public/cards/stld (fetched 2026-09-13; raw cache: packages/content/raw/marvelcdb/stld.json).
// Hand corrections / curated data: packages/content/scripts/marvelcdb/curation/stld.ts
// Regenerate: pnpm --filter @mc/content ingest -- --pack stld [--offline]

import { cardId, encounterSetId, setCode } from "../../schema/index.js";
import type { EncounterSet } from "../../schema/index.js";

export const STLD_ENCOUNTER_SETS: readonly EncounterSet[] = [
  {
    id: encounterSetId("stld_nemesis"),
    name: "Star-Lord Nemesis",
    packCodes: [setCode("stld")],
    nemesisOfIdentityId: cardId("17001a"),
  },
];
