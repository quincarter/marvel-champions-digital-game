// GENERATED FILE — do not edit by hand.
// Source: MarvelCDB public API https://marvelcdb.com/api/public/cards/psylocke (fetched 2026-09-13; raw cache: packages/content/raw/marvelcdb/psylocke.json).
// Hand corrections / curated data: packages/content/scripts/marvelcdb/curation/psylocke.ts
// Regenerate: pnpm --filter @mc/content ingest -- --pack psylocke [--offline]

import { cardId, encounterSetId, setCode } from "../../schema/index.js";
import type { EncounterSet } from "../../schema/index.js";

export const PSYLOCKE_ENCOUNTER_SETS: readonly EncounterSet[] = [
  {
    id: encounterSetId("psylocke_nemesis"),
    name: "Psylocke Nemesis",
    packCodes: [setCode("psylocke")],
    nemesisOfIdentityId: cardId("41001a"),
  },
];
