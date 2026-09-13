// GENERATED FILE — do not edit by hand.
// Source: MarvelCDB public API https://marvelcdb.com/api/public/cards/bkw (fetched 2026-09-13; raw cache: packages/content/raw/marvelcdb/bkw.json).
// Hand corrections / curated data: packages/content/scripts/marvelcdb/curation/bkw.ts
// Regenerate: pnpm --filter @mc/content ingest -- --pack bkw [--offline]

import { cardId, encounterSetId, setCode } from "../../schema/index.js";
import type { EncounterSet } from "../../schema/index.js";

export const BKW_ENCOUNTER_SETS: readonly EncounterSet[] = [
  {
    id: encounterSetId("black_widow_nemesis"),
    name: "Black Widow Nemesis",
    packCodes: [setCode("bkw")],
    nemesisOfIdentityId: cardId("08001a"),
  },
];
