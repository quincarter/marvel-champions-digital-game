// GENERATED FILE — do not edit by hand.
// Source: MarvelCDB public API https://marvelcdb.com/api/public/cards/ant (fetched 2026-09-13; raw cache: packages/content/raw/marvelcdb/ant.json).
// Hand corrections / curated data: packages/content/scripts/marvelcdb/curation/ant.ts
// Regenerate: pnpm --filter @mc/content ingest -- --pack ant [--offline]

import { cardId, encounterSetId, setCode } from "../../schema/index.js";
import type { EncounterSet } from "../../schema/index.js";

export const ANT_ENCOUNTER_SETS: readonly EncounterSet[] = [
  {
    id: encounterSetId("ant_nemesis"),
    name: "Ant-Man Nemesis",
    packCodes: [setCode("ant")],
    nemesisOfIdentityId: cardId("12001c"),
  },
];
