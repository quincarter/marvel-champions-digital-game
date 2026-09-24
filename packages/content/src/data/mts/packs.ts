// GENERATED FILE — do not edit by hand.
// Source: MarvelCDB public API https://marvelcdb.com/api/public/cards/mts (fetched 2026-09-13; raw cache: packages/content/raw/marvelcdb/mts.json).
// Hand corrections / curated data: packages/content/scripts/marvelcdb/curation/mts.ts
// Regenerate: pnpm --filter @mc/content ingest -- --pack mts [--offline]

import { cycleId, setCode } from "../../schema/index.js";
import type { Cycle, Pack } from "../../schema/index.js";

export const MTS_CYCLE: Cycle = { id: cycleId("cycle4"), name: "Cycle 4", order: 4 };

/** Release date source: Hall of Heroes The Mad Titan's Shadow page (https://hallofheroeslcg.com/the-mad-titans-shadow/): "Release date: October 29, 2021". */
export const MTS_PACK: Pack = {
  code: setCode("mts"),
  name: "The Mad Titan's Shadow",
  cycleId: cycleId("cycle4"),
  releaseDate: "2021-10-29",
};
