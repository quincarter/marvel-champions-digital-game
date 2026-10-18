// GENERATED FILE — do not edit by hand.
// Source: MarvelCDB public API https://marvelcdb.com/api/public/cards/jj (fetched 2026-09-13; raw cache: packages/content/raw/marvelcdb/jj.json).
// Hand corrections / curated data: packages/content/scripts/marvelcdb/curation/jj.ts
// Regenerate: pnpm --filter @mc/content ingest -- --pack jj [--offline]

import { cardId, encounterSetId, setCode } from "../../schema/index.js";
import type { EncounterSet } from "../../schema/index.js";

export const JJ_ENCOUNTER_SETS: readonly EncounterSet[] = [
  {
    id: encounterSetId("jessica_jones_nemesis"),
    name: "Jessica Jones Nemesis",
    packCodes: [setCode("jj")],
    nemesisOfIdentityId: cardId("61001a"),
  },
];
