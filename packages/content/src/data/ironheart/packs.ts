// GENERATED FILE — do not edit by hand.
// Source: MarvelCDB public API https://marvelcdb.com/api/public/cards/ironheart (fetched 2026-09-13; raw cache: packages/content/raw/marvelcdb/ironheart.json).
// Hand corrections / curated data: packages/content/scripts/marvelcdb/curation/ironheart.ts
// Regenerate: pnpm --filter @mc/content ingest -- --pack ironheart [--offline]

import { cycleId, setCode } from "../../schema/index.js";
import type { Cycle, Pack } from "../../schema/index.js";

export const IRONHEART_CYCLE: Cycle = { id: cycleId("cycle5"), name: "Cycle 5", order: 5 };

/** Release date source: Hall of Heroes Ironheart/Riri Williams page (https://hallofheroeslcg.com/ironheart-riri-williams/): "Release date: May 20, 2022" */
export const IRONHEART_PACK: Pack = {
  code: setCode("ironheart"),
  name: "Ironheart",
  cycleId: cycleId("cycle5"),
  releaseDate: "2022-05-20",
};
