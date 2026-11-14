// GENERATED FILE — do not edit by hand.
// Source: Hall of Heroes preview scans, hand-transcribed as addedRecords (no MarvelCDB pack "iron_fist": every record is an addedRecord transcribed from scans (curation/iron_fist.ts); export: packages/content/raw/hallofheroes/iron_fist.json).
// Hand corrections / curated data: packages/content/scripts/marvelcdb/curation/iron_fist.ts
// Regenerate: pnpm --filter @mc/content ingest -- --pack iron_fist [--offline]

import { cycleId, setCode } from "../../schema/index.js";
import type { Cycle, Pack } from "../../schema/index.js";

export const IRON_FIST_CYCLE: Cycle = { id: cycleId("cycle11"), name: "Fear No Evil", order: 11 };

/** Release date source: FFG announcement "Way of the Iron Fist" (https://www.fantasyflightgames.com/en/news/2026/8/27/way-of-the-iron-fist/) and Hall of Heroes (https://hallofheroeslcg.com/iron-fist-danny-rand/): "November 2026", released alongside Elektra, no day given (product code MC64en). The first of the month stands in for the unknown day. */
export const IRON_FIST_PACK: Pack = {
  code: setCode("iron_fist"),
  name: "Iron Fist",
  cycleId: cycleId("cycle11"),
  releaseDate: "2026-11-01",
};
