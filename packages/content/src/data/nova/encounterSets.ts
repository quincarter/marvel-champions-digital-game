// GENERATED FILE — do not edit by hand.
// Source: MarvelCDB public API https://marvelcdb.com/api/public/cards/nova (fetched 2026-09-13; raw cache: packages/content/raw/marvelcdb/nova.json).
// Hand corrections / curated data: packages/content/scripts/marvelcdb/curation/nova.ts
// Regenerate: pnpm --filter @mc/content ingest -- --pack nova [--offline]

import { cardId, encounterSetId, setCode } from "../../schema/index.js";
import type { EncounterSet } from "../../schema/index.js";

export const NOVA_ENCOUNTER_SETS: readonly EncounterSet[] = [
  { id: encounterSetId("armadillo"), name: "Armadillo", packCodes: [setCode("nova")] },
  {
    id: encounterSetId("nova_nemesis"),
    name: "Nova Nemesis",
    packCodes: [setCode("nova")],
    nemesisOfIdentityId: cardId("28001a"),
  },
];
