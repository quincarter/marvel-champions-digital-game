// GENERATED FILE — do not edit by hand.
// Source: MarvelCDB public API https://marvelcdb.com/api/public/cards/bp (fetched 2026-09-13; raw cache: packages/content/raw/marvelcdb/bp.json).
// Hand corrections / curated data: packages/content/scripts/marvelcdb/curation/bp.ts
// Regenerate: pnpm --filter @mc/content ingest -- --pack bp [--offline]

import { cardId, encounterSetId, setCode } from "../../schema/index.js";
import type { EncounterSet } from "../../schema/index.js";

export const BP_ENCOUNTER_SETS: readonly EncounterSet[] = [
  {
    id: encounterSetId("black_panther_shuri_nemesis"),
    name: "Black Panther (Shuri) Nemesis",
    packCodes: [setCode("bp")],
    nemesisOfIdentityId: cardId("51001a"),
  },
  { id: encounterSetId("extreme_risk"), name: "Extreme Risk", packCodes: [setCode("bp")] },
];
