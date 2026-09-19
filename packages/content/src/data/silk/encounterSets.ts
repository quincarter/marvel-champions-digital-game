// GENERATED FILE — do not edit by hand.
// Source: MarvelCDB public API https://marvelcdb.com/api/public/cards/silk (fetched 2026-09-13; raw cache: packages/content/raw/marvelcdb/silk.json).
// Hand corrections / curated data: packages/content/scripts/marvelcdb/curation/silk.ts
// Regenerate: pnpm --filter @mc/content ingest -- --pack silk [--offline]

import { cardId, encounterSetId, setCode } from "../../schema/index.js";
import type { EncounterSet } from "../../schema/index.js";

export const SILK_ENCOUNTER_SETS: readonly EncounterSet[] = [
  { id: encounterSetId("growing_strong"), name: "Growing Strong", packCodes: [setCode("silk")] },
  {
    id: encounterSetId("silk_nemesis"),
    name: "Silk Nemesis",
    packCodes: [setCode("silk")],
    nemesisOfIdentityId: cardId("52001a"),
  },
];
