// GENERATED FILE — do not edit by hand.
// Source: MarvelCDB public API https://marvelcdb.com/api/public/cards/deadpool (fetched 2026-09-13; raw cache: packages/content/raw/marvelcdb/deadpool.json).
// Hand corrections / curated data: packages/content/scripts/marvelcdb/curation/deadpool.ts
// Regenerate: pnpm --filter @mc/content ingest -- --pack deadpool [--offline]

import { cycleId, setCode } from "../../schema/index.js";
import type { Cycle, Pack } from "../../schema/index.js";

export const DEADPOOL_CYCLE: Cycle = { id: cycleId("cycle7"), name: "Cycle 7", order: 7 };

/** Release date source: Hall of Heroes Wade Wilson/Deadpool page (https://hallofheroeslcg.com/deadpool/): "Release date: November 17, 2023" */
export const DEADPOOL_PACK: Pack = {
  code: setCode("deadpool"),
  name: "Deadpool",
  cycleId: cycleId("cycle7"),
  releaseDate: "2023-11-17",
};
