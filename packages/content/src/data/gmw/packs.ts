// GENERATED FILE — do not edit by hand.
// Source: MarvelCDB public API https://marvelcdb.com/api/public/cards/gmw (fetched 2026-09-13; raw cache: packages/content/raw/marvelcdb/gmw.json).
// Hand corrections / curated data: packages/content/scripts/marvelcdb/curation/gmw.ts
// Regenerate: pnpm --filter @mc/content ingest -- --pack gmw [--offline]

import { cycleId, setCode } from "../../schema/index.js";
import type { Cycle, Pack } from "../../schema/index.js";

export const GMW_CYCLE: Cycle = { id: cycleId("cycle3"), name: "The Galaxy's Most Wanted", order: 3 };

/** Release date source: Hall of Heroes Galaxy's Most Wanted page (https://hallofheroeslcg.com/galaxys-most-wanted/): "Release date: April 2, 2021" */
export const GMW_PACK: Pack = {
  code: setCode("gmw"),
  name: "Galaxy's Most Wanted",
  cycleId: cycleId("cycle3"),
  releaseDate: "2021-04-02",
};
