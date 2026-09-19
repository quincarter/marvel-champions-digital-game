// GENERATED FILE — do not edit by hand.
// Source: MarvelCDB public API https://marvelcdb.com/api/public/cards/spdr (fetched 2026-09-13; raw cache: packages/content/raw/marvelcdb/spdr.json).
// Hand corrections / curated data: packages/content/scripts/marvelcdb/curation/spdr.ts
// Regenerate: pnpm --filter @mc/content ingest -- --pack spdr [--offline]

import { cardId, encounterSetId, setCode } from "../../schema/index.js";
import type { EncounterSet } from "../../schema/index.js";

export const SPDR_ENCOUNTER_SETS: readonly EncounterSet[] = [
  {
    id: encounterSetId("ironspider_sinister"),
    name: "Iron Spider's Sinister Six",
    packCodes: [setCode("spdr")],
  },
  {
    id: encounterSetId("spdr_nemesis"),
    name: "SP//dr Nemesis",
    packCodes: [setCode("spdr")],
    nemesisOfIdentityId: cardId("31001a"),
  },
];
