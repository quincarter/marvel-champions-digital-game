// GENERATED FILE — do not edit by hand.
// Source: MarvelCDB public API https://marvelcdb.com/api/public/cards/vision (fetched 2026-09-13; raw cache: packages/content/raw/marvelcdb/vision.json).
// Hand corrections / curated data: packages/content/scripts/marvelcdb/curation/vision.ts
// Regenerate: pnpm --filter @mc/content ingest -- --pack vision [--offline]

import { cardId, encounterSetId, setCode } from "../../schema/index.js";
import type { EncounterSet } from "../../schema/index.js";

export const VISION_ENCOUNTER_SETS: readonly EncounterSet[] = [
  {
    id: encounterSetId("vision_nemesis"),
    name: "Vision Nemesis",
    packCodes: [setCode("vision")],
    nemesisOfIdentityId: cardId("26001a"),
  },
];
