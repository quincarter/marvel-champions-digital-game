// GENERATED FILE — do not edit by hand.
// Source: MarvelCDB public API https://marvelcdb.com/api/public/cards/iron_fist (fetched 2026-11-25; raw cache: packages/content/raw/marvelcdb/iron_fist.json).
// Hand corrections / curated data: packages/content/scripts/marvelcdb/curation/iron_fist.ts
// Regenerate: pnpm --filter @mc/content ingest -- --pack iron_fist [--offline]

import { cycleId, setCode } from "../../schema/index.js";
import type { Cycle, Pack } from "../../schema/index.js";

export const IRON_FIST_CYCLE: Cycle = { id: cycleId("cycle11"), name: "Fear No Evil", order: 11 };

/** Release date source: MarvelCDB pack list (https://marvelcdb.com/api/public/packs/, code iron_fist, "available": "2026-11-13"), the same day as Elektra; FFG and Hall of Heroes give only "November 2026" (product code MC64en). */
export const IRON_FIST_PACK: Pack = {
  code: setCode("iron_fist"),
  name: "Iron Fist",
  cycleId: cycleId("cycle11"),
  releaseDate: "2026-11-13",
};
