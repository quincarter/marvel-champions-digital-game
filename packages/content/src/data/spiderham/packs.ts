// GENERATED FILE — do not edit by hand.
// Source: MarvelCDB public API https://marvelcdb.com/api/public/cards/spiderham (fetched 2026-09-13; raw cache: packages/content/raw/marvelcdb/spiderham.json).
// Hand corrections / curated data: packages/content/scripts/marvelcdb/curation/spiderham.ts
// Regenerate: pnpm --filter @mc/content ingest -- --pack spiderham [--offline]

import { cycleId, setCode } from "../../schema/index.js";
import type { Cycle, Pack } from "../../schema/index.js";

export const SPIDERHAM_CYCLE: Cycle = { id: cycleId("cycle5"), name: "Cycle 5", order: 5 };

/** Release date source: Hall of Heroes Spider-Ham/Peter Porker page (https://hallofheroeslcg.com/spider-ham-peter-porker/): "Release date: July 15, 2022" */
export const SPIDERHAM_PACK: Pack = {
  code: setCode("spiderham"),
  name: "Spider-Ham",
  cycleId: cycleId("cycle5"),
  releaseDate: "2022-07-15",
};
