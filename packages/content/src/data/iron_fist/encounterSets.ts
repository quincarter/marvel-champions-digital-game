// GENERATED FILE — do not edit by hand.
// Source: Hall of Heroes preview scans, hand-transcribed as addedRecords (no MarvelCDB pack "iron_fist": every record is an addedRecord transcribed from scans (curation/iron_fist.ts); export: packages/content/raw/hallofheroes/iron_fist.json).
// Hand corrections / curated data: packages/content/scripts/marvelcdb/curation/iron_fist.ts
// Regenerate: pnpm --filter @mc/content ingest -- --pack iron_fist [--offline]

import { cardId, encounterSetId, setCode } from "../../schema/index.js";
import type { EncounterSet } from "../../schema/index.js";

export const IRON_FIST_ENCOUNTER_SETS: readonly EncounterSet[] = [
  {
    id: encounterSetId("iron_fist_nemesis"),
    name: "Iron Fist Nemesis",
    packCodes: [setCode("iron_fist")],
    nemesisOfIdentityId: cardId("64001a"),
  },
];
