// GENERATED FILE — do not edit by hand.
// Source: MarvelCDB public API https://marvelcdb.com/api/public/cards/gambit (fetched 2026-09-13; raw cache: packages/content/raw/marvelcdb/gambit.json).
// Hand corrections / curated data: packages/content/scripts/marvelcdb/curation/gambit.ts
// Regenerate: pnpm --filter @mc/content ingest -- --pack gambit [--offline]

import { cardId, encounterSetId, setCode } from "../../schema/index.js";
import type { EncounterSet } from "../../schema/index.js";

export const GAMBIT_ENCOUNTER_SETS: readonly EncounterSet[] = [
  { id: encounterSetId("exodus"), name: "Exodus", packCodes: [setCode("gambit")] },
  {
    id: encounterSetId("gambit_nemesis"),
    name: "Gambit Nemesis",
    packCodes: [setCode("gambit")],
    nemesisOfIdentityId: cardId("37001a"),
  },
];
