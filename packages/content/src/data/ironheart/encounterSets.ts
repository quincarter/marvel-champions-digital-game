// GENERATED FILE — do not edit by hand.
// Source: MarvelCDB public API https://marvelcdb.com/api/public/cards/ironheart (fetched 2026-09-13; raw cache: packages/content/raw/marvelcdb/ironheart.json).
// Hand corrections / curated data: packages/content/scripts/marvelcdb/curation/ironheart.ts
// Regenerate: pnpm --filter @mc/content ingest -- --pack ironheart [--offline]

import { cardId, encounterSetId, setCode } from "../../schema/index.js";
import type { EncounterSet } from "../../schema/index.js";

export const IRONHEART_ENCOUNTER_SETS: readonly EncounterSet[] = [
  {
    id: encounterSetId("ironheart_nemesis"),
    name: "Ironheart Nemesis",
    packCodes: [setCode("ironheart")],
    nemesisOfIdentityId: cardId("29003a"),
  },
  { id: encounterSetId("zzzax"), name: "Zzzax", packCodes: [setCode("ironheart")] },
];
