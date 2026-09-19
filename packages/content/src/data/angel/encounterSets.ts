// GENERATED FILE — do not edit by hand.
// Source: MarvelCDB public API https://marvelcdb.com/api/public/cards/angel (fetched 2026-09-13; raw cache: packages/content/raw/marvelcdb/angel.json).
// Hand corrections / curated data: packages/content/scripts/marvelcdb/curation/angel.ts
// Regenerate: pnpm --filter @mc/content ingest -- --pack angel [--offline]

import { cardId, encounterSetId, setCode } from "../../schema/index.js";
import type { EncounterSet } from "../../schema/index.js";

export const ANGEL_ENCOUNTER_SETS: readonly EncounterSet[] = [
  {
    id: encounterSetId("angel_nemesis"),
    name: "Angel Nemesis",
    packCodes: [setCode("angel")],
    nemesisOfIdentityId: cardId("42001a"),
  },
];
