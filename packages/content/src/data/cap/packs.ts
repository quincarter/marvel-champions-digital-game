// GENERATED FILE — do not edit by hand.
// Source: MarvelCDB public API https://marvelcdb.com/api/public/cards/cap (fetched 2026-09-13; raw cache: packages/content/raw/marvelcdb/cap.json).
// Hand corrections / curated data: packages/content/scripts/marvelcdb/curation/cap.ts
// Regenerate: pnpm --filter @mc/content ingest -- --pack cap [--offline]

import { cycleId, setCode } from "../../schema/index.js";
import type { Cycle, Pack } from "../../schema/index.js";

export const CAP_CYCLE: Cycle = { id: cycleId("wave1"), name: "Wave 1", order: 1 };

/** Release date source: Hall of Heroes Captain America page (https://hallofheroeslcg.com/captain-america/): "Release date: December 20, 2019" */
export const CAP_PACK: Pack = {
  code: setCode("cap"),
  name: "Captain America",
  cycleId: cycleId("wave1"),
  releaseDate: "2019-12-20",
};
