// GENERATED FILE — do not edit by hand.
// Source: MarvelCDB public API https://marvelcdb.com/api/public/cards/gam (fetched 2026-09-13; raw cache: packages/content/raw/marvelcdb/gam.json).
// Hand corrections / curated data: packages/content/scripts/marvelcdb/curation/gam.ts
// Regenerate: pnpm --filter @mc/content ingest -- --pack gam [--offline]

import { cardId, encounterSetId, setCode } from "../../schema/index.js";
import type { EncounterSet } from "../../schema/index.js";

export const GAM_ENCOUNTER_SETS: readonly EncounterSet[] = [
  {
    id: encounterSetId("gam_nemesis"),
    name: "Gamora Nemesis",
    packCodes: [setCode("gam")],
    nemesisOfIdentityId: cardId("18001a"),
  },
];
