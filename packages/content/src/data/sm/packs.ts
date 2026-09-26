// GENERATED FILE — do not edit by hand.
// Source: MarvelCDB public API https://marvelcdb.com/api/public/cards/sm (fetched 2026-09-13; raw cache: packages/content/raw/marvelcdb/sm.json).
// Hand corrections / curated data: packages/content/scripts/marvelcdb/curation/sm.ts
// Regenerate: pnpm --filter @mc/content ingest -- --pack sm [--offline]

import { cycleId, setCode } from "../../schema/index.js";
import type { Cycle, Pack } from "../../schema/index.js";

export const SM_CYCLE: Cycle = { id: cycleId("cycle4"), name: "Cycle 4", order: 4 };

/** Release date source: Hall of Heroes Sinister Motives page (https://hallofheroeslcg.com/sinister-motives/): "Release date: April 8, 2022". */
export const SM_PACK: Pack = {
  code: setCode("sm"),
  name: "Sinister Motives",
  cycleId: cycleId("cycle4"),
  releaseDate: "2022-04-08",
};
