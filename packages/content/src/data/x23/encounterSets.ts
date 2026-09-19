// GENERATED FILE — do not edit by hand.
// Source: MarvelCDB public API https://marvelcdb.com/api/public/cards/x23 (fetched 2026-09-13; raw cache: packages/content/raw/marvelcdb/x23.json).
// Hand corrections / curated data: packages/content/scripts/marvelcdb/curation/x23.ts
// Regenerate: pnpm --filter @mc/content ingest -- --pack x23 [--offline]

import { cardId, encounterSetId, setCode } from "../../schema/index.js";
import type { EncounterSet } from "../../schema/index.js";

export const X23_ENCOUNTER_SETS: readonly EncounterSet[] = [
  {
    id: encounterSetId("x23_nemesis"),
    name: "X-23 Nemesis",
    packCodes: [setCode("x23")],
    nemesisOfIdentityId: cardId("43001a"),
  },
];
