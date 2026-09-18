// GENERATED FILE — do not edit by hand.
// Source: MarvelCDB public API https://marvelcdb.com/api/public/cards/wsp (fetched 2026-09-13; raw cache: packages/content/raw/marvelcdb/wsp.json).
// Hand corrections / curated data: packages/content/scripts/marvelcdb/curation/wsp.ts
// Regenerate: pnpm --filter @mc/content ingest -- --pack wsp [--offline]

import { cardId, encounterSetId, setCode } from "../../schema/index.js";
import type { EncounterSet } from "../../schema/index.js";

export const WSP_ENCOUNTER_SETS: readonly EncounterSet[] = [
  {
    id: encounterSetId("wsp_nemesis"),
    name: "Wasp Nemesis",
    packCodes: [setCode("wsp")],
    nemesisOfIdentityId: cardId("13001c"),
  },
];
