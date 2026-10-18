// GENERATED FILE — do not edit by hand.
// Source: MarvelCDB public API https://marvelcdb.com/api/public/cards/luke_cage (fetched 2026-09-13; raw cache: packages/content/raw/marvelcdb/luke_cage.json).
// Hand corrections / curated data: packages/content/scripts/marvelcdb/curation/luke_cage.ts
// Regenerate: pnpm --filter @mc/content ingest -- --pack luke_cage [--offline]

import { cycleId, setCode } from "../../schema/index.js";
import type { Cycle, Pack } from "../../schema/index.js";

export const LUKE_CAGE_CYCLE: Cycle = { id: cycleId("cycle11"), name: "Fear No Evil", order: 11 };

/** Release date source: MarvelCDB pack list (https://marvelcdb.com/api/public/packs/, code luke_cage, "available": "2026-08-21"), also the day decklist 65136 was posted; a pointer, since FFG gives only "August, 2026". */
export const LUKE_CAGE_PACK: Pack = {
  code: setCode("luke_cage"),
  name: "Luke Cage",
  cycleId: cycleId("cycle11"),
  releaseDate: "2026-08-21",
};
