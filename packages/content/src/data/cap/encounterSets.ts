// GENERATED FILE — do not edit by hand.
// Source: MarvelCDB public API https://marvelcdb.com/api/public/cards/cap (fetched 2026-09-13; raw cache: packages/content/raw/marvelcdb/cap.json).
// Hand corrections / curated data: packages/content/scripts/marvelcdb/curation/cap.ts
// Regenerate: pnpm --filter @mc/content ingest -- --pack cap [--offline]

import { cardId, encounterSetId, setCode } from "../../schema/index.js";
import type { EncounterSet } from "../../schema/index.js";

export const CAP_ENCOUNTER_SETS: readonly EncounterSet[] = [
  {
    id: encounterSetId("captain_america_nemesis"),
    name: "Captain America Nemesis",
    packCodes: [setCode("cap")],
    nemesisOfIdentityId: cardId("03001a"),
  },
];
