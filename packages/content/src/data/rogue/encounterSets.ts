// GENERATED FILE — do not edit by hand.
// Source: MarvelCDB public API https://marvelcdb.com/api/public/cards/rogue (fetched 2026-09-13; raw cache: packages/content/raw/marvelcdb/rogue.json).
// Hand corrections / curated data: packages/content/scripts/marvelcdb/curation/rogue.ts
// Regenerate: pnpm --filter @mc/content ingest -- --pack rogue [--offline]

import { cardId, encounterSetId, setCode } from "../../schema/index.js";
import type { EncounterSet } from "../../schema/index.js";

export const ROGUE_ENCOUNTER_SETS: readonly EncounterSet[] = [
  { id: encounterSetId("reavers"), name: "Reavers", packCodes: [setCode("rogue")] },
  {
    id: encounterSetId("rogue_nemesis"),
    name: "Rogue Nemesis",
    packCodes: [setCode("rogue")],
    nemesisOfIdentityId: cardId("38001a"),
  },
];
