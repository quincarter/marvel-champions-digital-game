// GENERATED FILE — do not edit by hand.
// Source: MarvelCDB public API https://marvelcdb.com/api/public/cards/jubilee (fetched 2026-09-13; raw cache: packages/content/raw/marvelcdb/jubilee.json).
// Hand corrections / curated data: packages/content/scripts/marvelcdb/curation/jubilee.ts
// Regenerate: pnpm --filter @mc/content ingest -- --pack jubilee [--offline]

import { cardId, encounterSetId, setCode } from "../../schema/index.js";
import type { EncounterSet } from "../../schema/index.js";

export const JUBILEE_ENCOUNTER_SETS: readonly EncounterSet[] = [
  { id: encounterSetId("arcade"), name: "Arcade", packCodes: [setCode("jubilee")] },
  {
    id: encounterSetId("jubilee_nemesis"),
    name: "Jubilee Nemesis",
    packCodes: [setCode("jubilee")],
    nemesisOfIdentityId: cardId("47001a"),
  },
];
