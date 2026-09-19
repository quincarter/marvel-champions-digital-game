// GENERATED FILE — do not edit by hand.
// Source: MarvelCDB public API https://marvelcdb.com/api/public/cards/ncrawler (fetched 2026-09-13; raw cache: packages/content/raw/marvelcdb/ncrawler.json).
// Hand corrections / curated data: packages/content/scripts/marvelcdb/curation/ncrawler.ts
// Regenerate: pnpm --filter @mc/content ingest -- --pack ncrawler [--offline]

import { cardId, encounterSetId, setCode } from "../../schema/index.js";
import type { EncounterSet } from "../../schema/index.js";

export const NCRAWLER_ENCOUNTER_SETS: readonly EncounterSet[] = [
  { id: encounterSetId("crazy_gang"), name: "Crazy Gang", packCodes: [setCode("ncrawler")] },
  {
    id: encounterSetId("nightcrawler_nemesis"),
    name: "Nightcrawler Nemesis",
    packCodes: [setCode("ncrawler")],
    nemesisOfIdentityId: cardId("48001a"),
  },
];
