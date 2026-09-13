// GENERATED FILE — do not edit by hand.
// Source: MarvelCDB public API https://marvelcdb.com/api/public/cards/twc (fetched 2026-09-13; raw cache: packages/content/raw/marvelcdb/twc.json).
// Hand corrections / curated data: packages/content/scripts/marvelcdb/curation/twc.ts
// Regenerate: pnpm --filter @mc/content ingest -- --pack twc [--offline]

import { cycleId, setCode } from "../../schema/index.js";
import type { Cycle, Pack } from "../../schema/index.js";

export const TWC_CYCLE: Cycle = { id: cycleId("wave1"), name: "Wave 1", order: 1 };

/** Release date source: Hall of Heroes The Wrecking Crew page (https://hallofheroeslcg.com/wrecking-crew/): "Release date: February 7, 2020" */
export const TWC_PACK: Pack = {
  code: setCode("twc"),
  name: "The Wrecking Crew",
  cycleId: cycleId("wave1"),
  releaseDate: "2020-02-07",
};
