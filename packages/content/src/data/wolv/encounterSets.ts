// GENERATED FILE — do not edit by hand.
// Source: MarvelCDB public API https://marvelcdb.com/api/public/cards/wolv (fetched 2026-09-13; raw cache: packages/content/raw/marvelcdb/wolv.json).
// Hand corrections / curated data: packages/content/scripts/marvelcdb/curation/wolv.ts
// Regenerate: pnpm --filter @mc/content ingest -- --pack wolv [--offline]

import { cardId, encounterSetId, setCode } from "../../schema/index.js";
import type { EncounterSet } from "../../schema/index.js";

export const WOLV_ENCOUNTER_SETS: readonly EncounterSet[] = [
  { id: encounterSetId("deathstrike"), name: "Deathstrike", packCodes: [setCode("wolv")] },
  {
    id: encounterSetId("wolverine_nemesis"),
    name: "Wolverine Nemesis",
    packCodes: [setCode("wolv")],
    nemesisOfIdentityId: cardId("35001a"),
  },
];
