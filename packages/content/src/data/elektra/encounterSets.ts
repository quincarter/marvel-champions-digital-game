// GENERATED FILE — do not edit by hand.
// Source: MarvelCDB public API https://marvelcdb.com/api/public/cards/elektra (fetched 2026-11-25; raw cache: packages/content/raw/marvelcdb/elektra.json).
// Hand corrections / curated data: packages/content/scripts/marvelcdb/curation/elektra.ts
// Regenerate: pnpm --filter @mc/content ingest -- --pack elektra [--offline]

import { cardId, encounterSetId, setCode } from "../../schema/index.js";
import type { EncounterSet } from "../../schema/index.js";

export const ELEKTRA_ENCOUNTER_SETS: readonly EncounterSet[] = [
  {
    id: encounterSetId("elektra_nemesis"),
    name: "Elektra Nemesis",
    packCodes: [setCode("elektra")],
    nemesisOfIdentityId: cardId("63001a"),
  },
];
