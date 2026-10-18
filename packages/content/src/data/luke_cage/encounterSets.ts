// GENERATED FILE — do not edit by hand.
// Source: MarvelCDB public API https://marvelcdb.com/api/public/cards/luke_cage (fetched 2026-09-13; raw cache: packages/content/raw/marvelcdb/luke_cage.json).
// Hand corrections / curated data: packages/content/scripts/marvelcdb/curation/luke_cage.ts
// Regenerate: pnpm --filter @mc/content ingest -- --pack luke_cage [--offline]

import { cardId, encounterSetId, setCode } from "../../schema/index.js";
import type { EncounterSet } from "../../schema/index.js";

export const LUKE_CAGE_ENCOUNTER_SETS: readonly EncounterSet[] = [
  {
    id: encounterSetId("luke_cage_nemesis"),
    name: "Luke Cage Nemesis",
    packCodes: [setCode("luke_cage")],
    nemesisOfIdentityId: cardId("62001a"),
  },
];
