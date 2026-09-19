// GENERATED FILE — do not edit by hand.
// Source: MarvelCDB public API https://marvelcdb.com/api/public/cards/wonder_man (fetched 2026-09-13; raw cache: packages/content/raw/marvelcdb/wonder_man.json).
// Hand corrections / curated data: packages/content/scripts/marvelcdb/curation/wonder_man.ts
// Regenerate: pnpm --filter @mc/content ingest -- --pack wonder_man [--offline]

import { cardId, encounterSetId, setCode } from "../../schema/index.js";
import type { EncounterSet } from "../../schema/index.js";

export const WONDER_MAN_ENCOUNTER_SETS: readonly EncounterSet[] = [
  {
    id: encounterSetId("wonder_man_nemesis"),
    name: "Wonder Man Nemesis",
    packCodes: [setCode("wonder_man")],
    nemesisOfIdentityId: cardId("58001a"),
  },
];
