// GENERATED FILE — do not edit by hand.
// Source: MarvelCDB public API https://marvelcdb.com/api/public/cards/cyclops (fetched 2026-09-13; raw cache: packages/content/raw/marvelcdb/cyclops.json).
// Hand corrections / curated data: packages/content/scripts/marvelcdb/curation/cyclops.ts
// Regenerate: pnpm --filter @mc/content ingest -- --pack cyclops [--offline]

import { cardId, encounterSetId, setCode } from "../../schema/index.js";
import type { EncounterSet } from "../../schema/index.js";

export const CYCLOPS_ENCOUNTER_SETS: readonly EncounterSet[] = [
  {
    id: encounterSetId("cyclops_nemesis"),
    name: "Cyclops Nemesis",
    packCodes: [setCode("cyclops")],
    nemesisOfIdentityId: cardId("33001a"),
  },
];
