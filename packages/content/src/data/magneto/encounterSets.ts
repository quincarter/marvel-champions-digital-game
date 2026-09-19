// GENERATED FILE — do not edit by hand.
// Source: MarvelCDB public API https://marvelcdb.com/api/public/cards/magneto (fetched 2026-09-13; raw cache: packages/content/raw/marvelcdb/magneto.json).
// Hand corrections / curated data: packages/content/scripts/marvelcdb/curation/magneto.ts
// Regenerate: pnpm --filter @mc/content ingest -- --pack magneto [--offline]

import { cardId, encounterSetId, setCode } from "../../schema/index.js";
import type { EncounterSet } from "../../schema/index.js";

export const MAGNETO_ENCOUNTER_SETS: readonly EncounterSet[] = [
  { id: encounterSetId("hellfire"), name: "Hellfire", packCodes: [setCode("magneto")] },
  {
    id: encounterSetId("magneto_nemesis"),
    name: "Magneto Nemesis",
    packCodes: [setCode("magneto")],
    nemesisOfIdentityId: cardId("49001a"),
  },
];
