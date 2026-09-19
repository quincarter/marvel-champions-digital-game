// GENERATED FILE — do not edit by hand.
// Source: MarvelCDB public API https://marvelcdb.com/api/public/cards/winter (fetched 2026-09-13; raw cache: packages/content/raw/marvelcdb/winter.json).
// Hand corrections / curated data: packages/content/scripts/marvelcdb/curation/winter.ts
// Regenerate: pnpm --filter @mc/content ingest -- --pack winter [--offline]

import { cardId, encounterSetId, setCode } from "../../schema/index.js";
import type { EncounterSet } from "../../schema/index.js";

export const WINTER_ENCOUNTER_SETS: readonly EncounterSet[] = [
  { id: encounterSetId("whiteout"), name: "Whiteout", packCodes: [setCode("winter")] },
  {
    id: encounterSetId("winter_soldier_nemesis"),
    name: "Winter Soldier Nemesis",
    packCodes: [setCode("winter")],
    nemesisOfIdentityId: cardId("54001a"),
  },
];
