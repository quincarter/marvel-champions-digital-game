// GENERATED FILE — do not edit by hand.
// Source: MarvelCDB public API https://marvelcdb.com/api/public/cards/jj (fetched 2026-09-13; raw cache: packages/content/raw/marvelcdb/jj.json).
// Hand corrections / curated data: packages/content/scripts/marvelcdb/curation/jj.ts
// Regenerate: pnpm --filter @mc/content ingest -- --pack jj [--offline]

import { cycleId, setCode } from "../../schema/index.js";
import type { Cycle, Pack } from "../../schema/index.js";

export const JJ_CYCLE: Cycle = { id: cycleId("cycle11"), name: "Fear No Evil", order: 11 };

/** Release date source: MarvelCDB pack list (https://marvelcdb.com/api/public/packs/, code jj, "available": "2026-08-21"), also the day decklist 65137 was posted; a pointer, since FFG gives only "August, 2026". */
export const JJ_PACK: Pack = {
  code: setCode("jj"),
  name: "Jessica Jones",
  cycleId: cycleId("cycle11"),
  releaseDate: "2026-08-21",
};
