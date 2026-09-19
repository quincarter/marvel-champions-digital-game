// GENERATED FILE — do not edit by hand.
// Source: MarvelCDB public API https://marvelcdb.com/api/public/cards/valk (fetched 2026-09-13; raw cache: packages/content/raw/marvelcdb/valk.json).
// Hand corrections / curated data: packages/content/scripts/marvelcdb/curation/valk.ts
// Regenerate: pnpm --filter @mc/content ingest -- --pack valk [--offline]

import { cardId, encounterSetId, setCode } from "../../schema/index.js";
import type { EncounterSet } from "../../schema/index.js";

export const VALK_ENCOUNTER_SETS: readonly EncounterSet[] = [
  {
    id: encounterSetId("valk_nemesis"),
    name: "Valkyrie Nemesis",
    packCodes: [setCode("valk")],
    nemesisOfIdentityId: cardId("25001a"),
  },
];
