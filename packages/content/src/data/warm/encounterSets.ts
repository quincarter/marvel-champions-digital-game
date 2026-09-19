// GENERATED FILE — do not edit by hand.
// Source: MarvelCDB public API https://marvelcdb.com/api/public/cards/warm (fetched 2026-09-13; raw cache: packages/content/raw/marvelcdb/warm.json).
// Hand corrections / curated data: packages/content/scripts/marvelcdb/curation/warm.ts
// Regenerate: pnpm --filter @mc/content ingest -- --pack warm [--offline]

import { cardId, encounterSetId, setCode } from "../../schema/index.js";
import type { EncounterSet } from "../../schema/index.js";

export const WARM_ENCOUNTER_SETS: readonly EncounterSet[] = [
  {
    id: encounterSetId("warm_nemesis"),
    name: "War Machine Nemesis",
    packCodes: [setCode("warm")],
    nemesisOfIdentityId: cardId("23001a"),
  },
];
