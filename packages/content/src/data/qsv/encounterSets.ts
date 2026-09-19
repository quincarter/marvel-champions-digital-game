// GENERATED FILE — do not edit by hand.
// Source: MarvelCDB public API https://marvelcdb.com/api/public/cards/qsv (fetched 2026-09-13; raw cache: packages/content/raw/marvelcdb/qsv.json).
// Hand corrections / curated data: packages/content/scripts/marvelcdb/curation/qsv.ts
// Regenerate: pnpm --filter @mc/content ingest -- --pack qsv [--offline]

import { cardId, encounterSetId, setCode } from "../../schema/index.js";
import type { EncounterSet } from "../../schema/index.js";

export const QSV_ENCOUNTER_SETS: readonly EncounterSet[] = [
  {
    id: encounterSetId("qsv_nemesis"),
    name: "Quicksilver Nemesis",
    packCodes: [setCode("qsv")],
    nemesisOfIdentityId: cardId("14001a"),
  },
];
