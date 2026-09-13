// GENERATED FILE — do not edit by hand.
// Source: MarvelCDB public API https://marvelcdb.com/api/public/cards/msm (fetched 2026-09-13; raw cache: packages/content/raw/marvelcdb/msm.json).
// Hand corrections / curated data: packages/content/scripts/marvelcdb/curation/msm.ts
// Regenerate: pnpm --filter @mc/content ingest -- --pack msm [--offline]

import { cardId, encounterSetId, setCode } from "../../schema/index.js";
import type { EncounterSet } from "../../schema/index.js";

export const MSM_ENCOUNTER_SETS: readonly EncounterSet[] = [
  {
    id: encounterSetId("ms_marvel_nemesis"),
    name: "Ms. Marvel Nemesis",
    packCodes: [setCode("msm")],
    nemesisOfIdentityId: cardId("05001a"),
  },
];
