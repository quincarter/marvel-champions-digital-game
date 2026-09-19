// GENERATED FILE — do not edit by hand.
// Source: MarvelCDB public API https://marvelcdb.com/api/public/cards/storm (fetched 2026-09-13; raw cache: packages/content/raw/marvelcdb/storm.json).
// Hand corrections / curated data: packages/content/scripts/marvelcdb/curation/storm.ts
// Regenerate: pnpm --filter @mc/content ingest -- --pack storm [--offline]

import { cardId, encounterSetId, setCode } from "../../schema/index.js";
import type { EncounterSet } from "../../schema/index.js";

export const STORM_ENCOUNTER_SETS: readonly EncounterSet[] = [
  { id: encounterSetId("shadow_king"), name: "Shadow King", packCodes: [setCode("storm")] },
  {
    id: encounterSetId("storm_nemesis"),
    name: "Storm Nemesis",
    packCodes: [setCode("storm")],
    nemesisOfIdentityId: cardId("36001a"),
  },
];
