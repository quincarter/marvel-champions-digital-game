// GENERATED FILE — do not edit by hand.
// Source: MarvelCDB public API https://marvelcdb.com/api/public/cards/drax (fetched 2026-09-13; raw cache: packages/content/raw/marvelcdb/drax.json).
// Hand corrections / curated data: packages/content/scripts/marvelcdb/curation/drax.ts
// Regenerate: pnpm --filter @mc/content ingest -- --pack drax [--offline]

import { cardId, encounterSetId, setCode } from "../../schema/index.js";
import type { EncounterSet } from "../../schema/index.js";

export const DRAX_ENCOUNTER_SETS: readonly EncounterSet[] = [
  {
    id: encounterSetId("drax_nemesis"),
    name: "Drax Nemesis",
    packCodes: [setCode("drax")],
    nemesisOfIdentityId: cardId("19001a"),
  },
];
