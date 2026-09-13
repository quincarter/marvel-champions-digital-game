// GENERATED FILE — do not edit by hand.
// Source: MarvelCDB public API https://marvelcdb.com/api/public/cards/hlk (fetched 2026-09-13; raw cache: packages/content/raw/marvelcdb/hlk.json).
// Hand corrections / curated data: packages/content/scripts/marvelcdb/curation/hlk.ts
// Regenerate: pnpm --filter @mc/content ingest -- --pack hlk [--offline]

import { cardId, encounterSetId, setCode } from "../../schema/index.js";
import type { EncounterSet } from "../../schema/index.js";

export const HLK_ENCOUNTER_SETS: readonly EncounterSet[] = [
  {
    id: encounterSetId("hulk_nemesis"),
    name: "Hulk Nemesis",
    packCodes: [setCode("hlk")],
    nemesisOfIdentityId: cardId("10001a"),
  },
];
