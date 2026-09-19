// GENERATED FILE — do not edit by hand.
// Source: MarvelCDB public API https://marvelcdb.com/api/public/cards/vnm (fetched 2026-09-13; raw cache: packages/content/raw/marvelcdb/vnm.json).
// Hand corrections / curated data: packages/content/scripts/marvelcdb/curation/vnm.ts
// Regenerate: pnpm --filter @mc/content ingest -- --pack vnm [--offline]

import { cardId, encounterSetId, setCode } from "../../schema/index.js";
import type { EncounterSet } from "../../schema/index.js";

export const VNM_ENCOUNTER_SETS: readonly EncounterSet[] = [
  {
    id: encounterSetId("vnm_nemesis"),
    name: "Venom Nemesis",
    packCodes: [setCode("vnm")],
    nemesisOfIdentityId: cardId("20001a"),
  },
];
