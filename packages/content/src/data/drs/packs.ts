// GENERATED FILE — do not edit by hand.
// Source: MarvelCDB public API https://marvelcdb.com/api/public/cards/drs (fetched 2026-09-13; raw cache: packages/content/raw/marvelcdb/drs.json).
// Hand corrections / curated data: packages/content/scripts/marvelcdb/curation/drs.ts
// Regenerate: pnpm --filter @mc/content ingest -- --pack drs [--offline]

import { cycleId, setCode } from "../../schema/index.js";
import type { Cycle, Pack } from "../../schema/index.js";

export const DRS_CYCLE: Cycle = { id: cycleId("wave1"), name: "Wave 1", order: 1 };

/** Release date source: Hall of Heroes Doctor Strange page (https://hallofheroeslcg.com/stephen-strange-doctor-strange/): "Release date: July 3, 2020 (originally May, 2020)" */
export const DRS_PACK: Pack = {
  code: setCode("drs"),
  name: "Doctor Strange",
  cycleId: cycleId("wave1"),
  releaseDate: "2020-07-03",
};
